#!/usr/bin/env python3
"""
sqlpeek.py - Inspect SQL Server schemas, tables, and views.

Usage examples:
  python scripts/sqlpeek.py
  python scripts/sqlpeek.py --list-schemas
  python scripts/sqlpeek.py --list-objects --schema dbo
  python scripts/sqlpeek.py --schema dbo --object Users --action definition
  python scripts/sqlpeek.py --schema dbo --object Users --action data --top 25
  python scripts/sqlpeek.py --env-file /path/to/.env --list-schemas --json
  python scripts/sqlpeek.py --schema dbo --object Users --action data --json --json-out /tmp/users.json

Flags:
  --env-file PATH
    Load environment variables from PATH (default: /mnt/docker/web/everday/.env.dev).
  --list-schemas
    List non-system schemas and exit.
  --list-objects
    List tables/views in the schema provided by --schema and exit.
  --schema NAME
    Schema name for --list-objects or --action.
  --object NAME
    Table/view name for --action.
  --action {definition,data}
    Non-interactive action to run against the target object.
  --top N
    Row limit for --action data (default: 10, max: 5000).
  --json
    Output results as JSON (non-interactive only).
  --json-out PATH
    Write JSON output to PATH (requires --json).
"""
import argparse
import json
import os
import textwrap
from datetime import date, datetime, time
from decimal import Decimal
from typing import Dict, List, Tuple, Optional, Sequence

import pyodbc  # type: ignore[reportMissingImports]
from dotenv import load_dotenv

try:
    from tabulate import tabulate  # type: ignore[reportMissingModuleSource]
except Exception:
    tabulate = None


# Defaults that can be customized per environment.
DEFAULT_ENV_PATH = "/mnt/docker/web/everday/.env.dev"
DEFAULT_TOP_ROWS = 10
MAX_TOP_ROWS = 5000
SQL_TYPE_DATETIMEOFFSET = -155
REQUIRED_ENV_VARS = [
    "SQLSERVER_HOST",
    "SQLSERVER_PORT",
    "SQLSERVER_DB",
    "SQLSERVER_DRIVER",
    "SQLSERVER_ADMIN_LOGIN",
    "SQLSERVER_ADMIN_PASSWORD",
]


# Pull required environment values with a clear error if missing.
def GetEnvValue(Key: str, Required: bool = True) -> str:
    Value = os.getenv(Key)
    if (Value is None or str(Value).strip() == "") and Required:
        raise RuntimeError(f"Missing required env var: {Key}")
    return (Value or "").strip()


def ToStr(Value: object) -> str:
    return "" if Value is None else str(Value)


def ToInt(Value: object, Default: int = 0) -> int:
    if Value is None:
        return Default
    if isinstance(Value, bool):
        return 1 if Value else 0
    if isinstance(Value, int):
        return Value
    if isinstance(Value, float):
        return int(Value)
    if isinstance(Value, Decimal):
        return int(Value)
    if isinstance(Value, (str, bytes, bytearray)):
        try:
            return int(Value)
        except ValueError:
            return Default
    return Default


def ToBool(Value: object) -> bool:
    return bool(Value)


# Load .env for local/dev workflows, defaulting to .env.dev.
def LoadEnvFile(EnvPath: str) -> None:
    if not EnvPath:
        return
    if not os.path.exists(EnvPath):
        raise RuntimeError(f"Env file not found: {EnvPath}")
    load_dotenv(dotenv_path=EnvPath)


def ValidateRequiredEnv() -> None:
    Missing = []
    for Key in REQUIRED_ENV_VARS:
        Value = os.getenv(Key)
        if Value is None or str(Value).strip() == "":
            Missing.append(Key)
    if Missing:
        MissingText = ", ".join(Missing)
        raise RuntimeError(f"Missing required env vars: {MissingText}")


# Handle SQL Server datetimeoffset values returned as a raw binary type.
def ConvertDatetimeOffset(Value: object) -> object:
    if Value is None:
        return None
    if isinstance(Value, (bytes, bytearray, memoryview)):
        return bytes(Value).hex()
    return str(Value)


def RegisterOutputConverters(Connection: pyodbc.Connection) -> None:
    add_connection_converter = getattr(Connection, "add_output_converter", None)
    if callable(add_connection_converter):
        add_connection_converter(SQL_TYPE_DATETIMEOFFSET, ConvertDatetimeOffset)
        return
    add_module_converter = getattr(pyodbc, "add_output_converter", None)
    if callable(add_module_converter):
        add_module_converter(SQL_TYPE_DATETIMEOFFSET, ConvertDatetimeOffset)


# Build a SQL Server connection string from env vars.
def BuildConnectionString() -> str:
    Host = GetEnvValue("SQLSERVER_HOST")
    Port = GetEnvValue("SQLSERVER_PORT")
    Database = GetEnvValue("SQLSERVER_DB")
    Driver = GetEnvValue("SQLSERVER_DRIVER").strip('"')
    Username = GetEnvValue("SQLSERVER_ADMIN_LOGIN")
    Password = GetEnvValue("SQLSERVER_ADMIN_PASSWORD")

    return (
        f"DRIVER={{{Driver}}};"
        f"SERVER={Host},{Port};"
        f"DATABASE={Database};"
        f"UID={Username};"
        f"PWD={Password};"
        "Encrypt=yes;"
        "TrustServerCertificate=yes;"
        "Connection Timeout=10;"
    )


# Create a pyodbc connection with a short timeout.
def Connect() -> pyodbc.Connection:
    ConnectionString = BuildConnectionString()
    Connection = pyodbc.connect(ConnectionString)
    RegisterOutputConverters(Connection)
    return Connection


# Execute a query and return rows.
def QueryRows(Cursor: pyodbc.Cursor, SqlText: str, Params: Tuple = ()) -> List[Tuple[object, ...]]:
    Cursor.execute(SqlText, Params)
    return [tuple(Row) for Row in Cursor.fetchall()]


# Keep TOP limits reasonable for ad-hoc inspection.
def ClampTopN(Value: int, Minimum: int = 1, Maximum: int = MAX_TOP_ROWS) -> int:
    return max(Minimum, min(Maximum, Value))


# Render tabular output using tabulate when available.
def PrintTable(Headers: List[str], Rows: Sequence[Sequence[object]]) -> None:
    if tabulate:
        print(tabulate(Rows, headers=Headers, tablefmt="github"))
        return

    ColumnWidths = [len(h) for h in Headers]
    for Row in Rows:
        for Index, Cell in enumerate(Row):
            ColumnWidths[Index] = max(ColumnWidths[Index], len(str(Cell)))

    def FormatRow(Cells: List[str]) -> str:
        return " | ".join(Cell.ljust(ColumnWidths[i]) for i, Cell in enumerate(Cells))

    print(FormatRow(Headers))
    print("-+-".join("-" * w for w in ColumnWidths))
    for Row in Rows:
        print(FormatRow([str(x) for x in Row]))


# Simple terminal prompt helper for interactive mode.
def PromptChoice(Prompt: str, Options: List[str], AllowBack: bool = True) -> Optional[int]:
    while True:
        print()
        print(Prompt)
        for Index, Option in enumerate(Options, start=1):
            print(f"  {Index}. {Option}")
        if AllowBack:
            print("  b. Back")
        print("  q. Quit")

        Choice = input("> ").strip().lower()
        if Choice == "q":
            return None
        if AllowBack and Choice == "b":
            return -1
        if Choice.isdigit():
            Value = int(Choice)
            if 1 <= Value <= len(Options):
                return Value - 1
        print("Invalid choice.")


# List non-system schemas.
def ListSchemas(Cursor: pyodbc.Cursor) -> List[str]:
    Rows = QueryRows(
        Cursor,
        """
        SELECT s.name
        FROM sys.schemas s
        WHERE s.name NOT IN ('sys', 'INFORMATION_SCHEMA')
        ORDER BY s.name;
        """,
    )
    return [ToStr(r[0]) for r in Rows]


# List tables/views in a schema.
def ListObjectsInSchema(Cursor: pyodbc.Cursor, SchemaName: str) -> List[Tuple[str, str]]:
    Rows = QueryRows(
        Cursor,
        """
        SELECT o.name,
               CASE WHEN o.type = 'U' THEN 'TABLE'
                    WHEN o.type = 'V' THEN 'VIEW'
                    ELSE o.type_desc END AS ObjectType
        FROM sys.objects o
        JOIN sys.schemas s ON s.schema_id = o.schema_id
        WHERE s.name = ?
          AND o.type IN ('U', 'V')
        ORDER BY ObjectType, o.name;
        """,
        (SchemaName,),
    )
    return [(ToStr(r[0]), ToStr(r[1])) for r in Rows]


# Resolve the object type for a table/view, if it exists.
def GetObjectType(Cursor: pyodbc.Cursor, SchemaName: str, ObjectName: str) -> Optional[str]:
    Rows = QueryRows(
        Cursor,
        """
        SELECT CASE WHEN o.type = 'U' THEN 'TABLE'
                    WHEN o.type = 'V' THEN 'VIEW'
                    ELSE o.type_desc END AS ObjectType
        FROM sys.objects o
        JOIN sys.schemas s ON s.schema_id = o.schema_id
        WHERE s.name = ? AND o.name = ? AND o.type IN ('U', 'V');
        """,
        (SchemaName, ObjectName),
    )
    return ToStr(Rows[0][0]) if Rows else None


# Fetch the definition for a view.
def GetViewDefinition(Cursor: pyodbc.Cursor, SchemaName: str, ObjectName: str) -> str:
    Rows = QueryRows(
        Cursor,
        """
        SELECT m.definition
        FROM sys.sql_modules m
        JOIN sys.objects o ON o.object_id = m.object_id
        JOIN sys.schemas s ON s.schema_id = o.schema_id
        WHERE s.name = ? AND o.name = ? AND o.type = 'V';
        """,
        (SchemaName, ObjectName),
    )
    return ToStr(Rows[0][0]) if Rows else ""


# Fetch core column metadata for a table.
def GetTableColumns(Cursor: pyodbc.Cursor, SchemaName: str, ObjectName: str) -> List[Tuple[object, ...]]:
    return QueryRows(
        Cursor,
        """
        SELECT
            c.column_id,
            c.name AS ColumnName,
            t.name AS TypeName,
            c.max_length,
            c.precision,
            c.scale,
            c.is_nullable,
            c.is_identity,
            dc.definition AS DefaultDefinition
        FROM sys.columns c
        JOIN sys.objects o ON o.object_id = c.object_id
        JOIN sys.schemas s ON s.schema_id = o.schema_id
        JOIN sys.types t ON t.user_type_id = c.user_type_id
        LEFT JOIN sys.default_constraints dc ON dc.parent_object_id = c.object_id AND dc.parent_column_id = c.column_id
        WHERE s.name = ? AND o.name = ? AND o.type = 'U'
        ORDER BY c.column_id;
        """,
        (SchemaName, ObjectName),
    )


# Convert SQL Server type metadata into readable type declarations.
def FormatSqlServerType(TypeName: str, MaxLength: int, Precision: int, Scale: int) -> str:
    Lower = TypeName.lower()
    if Lower in ("varchar", "char", "varbinary", "binary"):
        Length = "MAX" if MaxLength == -1 else str(MaxLength)
        return f"{TypeName}({Length})"
    if Lower in ("nvarchar", "nchar"):
        Length = "MAX" if MaxLength == -1 else str(int(MaxLength / 2))
        return f"{TypeName}({Length})"
    if Lower in ("decimal", "numeric"):
        return f"{TypeName}({Precision},{Scale})"
    if Lower in ("datetime2", "time", "datetimeoffset"):
        return f"{TypeName}({Scale})"
    return TypeName


# Collect non-PK index info per column for inline annotations.
def GetColumnIndexes(Cursor: pyodbc.Cursor, SchemaName: str, ObjectName: str) -> Dict[str, List[str]]:
    Rows = QueryRows(
        Cursor,
        """
        SELECT i.name,
               i.type_desc,
               i.is_unique,
               i.is_primary_key,
               i.is_unique_constraint,
               ic.is_included_column,
               c.name AS ColumnName
        FROM sys.indexes i
        JOIN sys.objects o ON o.object_id = i.object_id
        JOIN sys.schemas s ON s.schema_id = o.schema_id
        JOIN sys.index_columns ic ON ic.object_id = i.object_id AND ic.index_id = i.index_id
        JOIN sys.columns c ON c.object_id = ic.object_id AND c.column_id = ic.column_id
        WHERE s.name = ? AND o.name = ?
          AND i.is_hypothetical = 0
          AND i.name IS NOT NULL;
        """,
        (SchemaName, ObjectName),
    )
    IndexMap: Dict[str, List[str]] = {}
    for IndexName, TypeDesc, IsUnique, IsPrimaryKey, IsUniqueConstraint, IsIncluded, ColumnName in Rows:
        if ToBool(IsPrimaryKey) or ToBool(IsUniqueConstraint):
            continue
        Tags = []
        if TypeDesc:
            Tags.append(ToStr(TypeDesc).lower())
        Tags.append("include" if ToBool(IsIncluded) else "key")
        if ToBool(IsUnique):
            Tags.append("unique")
        TagText = ", ".join(Tags) if Tags else "key"
        Entry = f"{ToStr(IndexName)} ({TagText})"
        ColumnKey = ToStr(ColumnName)
        IndexMap.setdefault(ColumnKey, [])
        if Entry not in IndexMap[ColumnKey]:
            IndexMap[ColumnKey].append(Entry)
    return IndexMap


# Collect FK info per column for inline annotations.
def GetColumnForeignKeys(Cursor: pyodbc.Cursor, SchemaName: str, ObjectName: str) -> Dict[str, List[str]]:
    Rows = QueryRows(
        Cursor,
        """
        SELECT fk.name,
               pc.name AS ParentColumn,
               rs.name AS RefSchema,
               rt.name AS RefTable,
               rc.name AS RefColumn
        FROM sys.foreign_keys fk
        JOIN sys.foreign_key_columns fkc ON fk.object_id = fkc.constraint_object_id
        JOIN sys.tables pt ON fk.parent_object_id = pt.object_id
        JOIN sys.schemas ps ON ps.schema_id = pt.schema_id
        JOIN sys.columns pc ON fkc.parent_object_id = pc.object_id AND fkc.parent_column_id = pc.column_id
        JOIN sys.tables rt ON fk.referenced_object_id = rt.object_id
        JOIN sys.schemas rs ON rs.schema_id = rt.schema_id
        JOIN sys.columns rc ON fkc.referenced_object_id = rc.object_id AND fkc.referenced_column_id = rc.column_id
        WHERE ps.name = ? AND pt.name = ?
        ORDER BY fk.name, fkc.constraint_column_id;
        """,
        (SchemaName, ObjectName),
    )
    FkMap: Dict[str, List[str]] = {}
    for FkName, ColumnName, RefSchema, RefTable, RefColumn in Rows:
        Entry = f"{ToStr(FkName)} -> [{ToStr(RefSchema)}].[{ToStr(RefTable)}]([{ToStr(RefColumn)}])"
        ColumnKey = ToStr(ColumnName)
        FkMap.setdefault(ColumnKey, [])
        if Entry not in FkMap[ColumnKey]:
            FkMap[ColumnKey].append(Entry)
    return FkMap


# Build a CREATE TABLE statement with optional inline annotations.
def GetTableDefinition(Cursor: pyodbc.Cursor, SchemaName: str, ObjectName: str) -> str:
    Columns = GetTableColumns(Cursor, SchemaName, ObjectName)
    if not Columns:
        return ""

    IndexMap = GetColumnIndexes(Cursor, SchemaName, ObjectName)
    FkMap = GetColumnForeignKeys(Cursor, SchemaName, ObjectName)

    Lines = []
    Lines.append(f"CREATE TABLE [{SchemaName}].[{ObjectName}] (")
    ColumnLines = []
    for Row in Columns:
        (
            _,
            ColumnName,
            TypeName,
            MaxLength,
            Precision,
            Scale,
            IsNullable,
            IsIdentity,
            DefaultDefinition,
        ) = Row
        SqlType = FormatSqlServerType(
            ToStr(TypeName),
            ToInt(MaxLength),
            ToInt(Precision),
            ToInt(Scale),
        )
        IdentityPart = " IDENTITY(1,1)" if ToBool(IsIdentity) else ""
        NullPart = " NULL" if ToBool(IsNullable) else " NOT NULL"
        DefaultPart = f" DEFAULT {ToStr(DefaultDefinition)}" if DefaultDefinition is not None else ""
        Notes: List[str] = []
        ColumnKey = ToStr(ColumnName)
        if ColumnKey in IndexMap:
            Notes.append(f"Indexes: {', '.join(IndexMap[ColumnKey])}")
        if ColumnKey in FkMap:
            Notes.append(f"FKs: {', '.join(FkMap[ColumnKey])}")
        NotePart = f" -- {'; '.join(Notes)}" if Notes else ""
        ColumnLines.append(f"    [{ColumnKey}] {SqlType}{IdentityPart}{DefaultPart}{NullPart}{NotePart}")
    Lines.append(",\n".join(ColumnLines))
    Lines.append(");")

    PkRows = QueryRows(
        Cursor,
        """
        SELECT kc.name AS ConstraintName,
               c.name AS ColumnName,
               ic.key_ordinal
        FROM sys.key_constraints kc
        JOIN sys.objects o ON o.object_id = kc.parent_object_id
        JOIN sys.schemas s ON s.schema_id = o.schema_id
        JOIN sys.index_columns ic ON ic.object_id = kc.parent_object_id AND ic.index_id = kc.unique_index_id
        JOIN sys.columns c ON c.object_id = ic.object_id AND c.column_id = ic.column_id
        WHERE s.name = ? AND o.name = ? AND kc.type = 'PK'
        ORDER BY ic.key_ordinal;
        """,
        (SchemaName, ObjectName),
    )
    if PkRows:
        ConstraintName = ToStr(PkRows[0][0])
        PkCols = ", ".join(f"[{ToStr(r[1])}]" for r in PkRows)
        Lines.append("")
        Lines.append(f"ALTER TABLE [{SchemaName}].[{ObjectName}] ADD CONSTRAINT [{ConstraintName}] PRIMARY KEY ({PkCols});")

    return "\n".join(Lines)


# Fetch rows from a table/view.
def FetchData(
    Cursor: pyodbc.Cursor,
    SchemaName: str,
    ObjectName: str,
    TopN: int,
) -> Tuple[List[str], List[Tuple[object, ...]]]:
    SqlText = f"SELECT TOP ({TopN}) * FROM [{SchemaName}].[{ObjectName}];"
    Cursor.execute(SqlText)
    Columns = [d[0] for d in Cursor.description]
    Rows = [tuple(Row) for Row in Cursor.fetchall()]
    return Columns, Rows


# Print row data with truncation for terminal readability.
def PrintData(Cursor: pyodbc.Cursor, SchemaName: str, ObjectName: str, TopN: int) -> None:
    Columns, Rows = FetchData(Cursor, SchemaName, ObjectName, TopN)

    def Trunc(Value: object, Limit: int = 160) -> str:
        Text = "" if Value is None else str(Value)
        return Text if len(Text) <= Limit else Text[:Limit] + "…"

    DisplayRows = [tuple(Trunc(v) for v in Row) for Row in Rows]
    PrintTable(Columns, DisplayRows)


def JsonifyValue(Value: object) -> object:
    if Value is None:
        return None
    if isinstance(Value, (str, int, float, bool)):
        return Value
    if isinstance(Value, bytes):
        return Value.hex()
    if isinstance(Value, (datetime, date, time)):
        return Value.isoformat()
    if isinstance(Value, Decimal):
        return str(Value)
    return str(Value)


def WriteJson(Payload: object, OutputPath: Optional[str]) -> None:
    Text = json.dumps(Payload, indent=2, default=JsonifyValue)
    if OutputPath:
        with open(OutputPath, "w", encoding="utf-8") as Handle:
            Handle.write(Text + "\n")
    else:
        print(Text)


def BuildJsonRows(Rows: Sequence[Sequence[object]]) -> List[List[object]]:
    return [[JsonifyValue(Value) for Value in Row] for Row in Rows]


# Parse non-interactive flags; interactive mode remains the default.
def ParseArgs() -> argparse.Namespace:
    Parser = argparse.ArgumentParser(description="Peek at SQL Server schemas, tables, and views.")
    Parser.add_argument(
        "--env-file",
        default=DEFAULT_ENV_PATH,
        help=f"Path to .env file (default: {DEFAULT_ENV_PATH}).",
    )
    Parser.add_argument("--list-schemas", action="store_true", help="List schemas and exit.")
    Parser.add_argument("--list-objects", action="store_true", help="List tables/views in --schema and exit.")
    Parser.add_argument("--schema", help="Schema name for --list-objects/--action.")
    Parser.add_argument("--object", help="Table/view name for --action.")
    Parser.add_argument("--action", choices=["definition", "data"], help="Non-interactive action to run.")
    Parser.add_argument(
        "--top",
        type=int,
        default=DEFAULT_TOP_ROWS,
        help=f"Top N rows for --action data (1-{MAX_TOP_ROWS}).",
    )
    Parser.add_argument("--json", action="store_true", help="Output results as JSON (non-interactive only).")
    Parser.add_argument("--json-out", help="Write JSON output to file path.")
    Args = Parser.parse_args()

    ModeCount = sum([Args.list_schemas, Args.list_objects, bool(Args.action)])
    if ModeCount > 1:
        Parser.error("Choose only one of --list-schemas, --list-objects, or --action.")
    if Args.list_objects and not Args.schema:
        Parser.error("--list-objects requires --schema.")
    if Args.object and not Args.schema:
        Parser.error("--object requires --schema.")
    if Args.action and (not Args.schema or not Args.object):
        Parser.error("--action requires --schema and --object.")
    if (Args.schema or Args.object) and not Args.list_objects and not Args.action:
        Parser.error("Use --list-objects or --action with --schema/--object, or omit flags for interactive mode.")
    if Args.json_out and not Args.json:
        Parser.error("--json-out requires --json.")
    if Args.json and ModeCount == 0:
        Parser.error("--json is only supported with non-interactive flags.")
    return Args


def BuildJsonObjects(Objects: Sequence[Sequence[object]]) -> List[Dict[str, str]]:
    Items: List[Dict[str, str]] = []
    for Obj in Objects:
        if len(Obj) < 2:
            continue
        Items.append({"name": ToStr(Obj[0]), "type": ToStr(Obj[1])})
    return Items


# Execute non-interactive actions for scripting use.
def RunNonInteractive(Cursor: pyodbc.Cursor, Args: argparse.Namespace) -> int:
    if Args.list_schemas:
        Schemas = ListSchemas(Cursor)
        if Args.json:
            WriteJson({"schemas": Schemas}, Args.json_out)
        else:
            PrintTable(["Schema"], [(s,) for s in Schemas])
        return 0

    if Args.list_objects:
        Objects = ListObjectsInSchema(Cursor, Args.schema)
        if not Objects:
            print(f"No tables/views found in schema: {Args.schema}")
            return 0
        if Args.json:
            WriteJson({"schema": Args.schema, "objects": BuildJsonObjects(Objects)}, Args.json_out)
        else:
            PrintTable(["Name", "Type"], Objects)
        return 0

    if Args.action:
        ObjectType = GetObjectType(Cursor, Args.schema, Args.object)
        if not ObjectType:
            print(f"Object not found: [{Args.schema}].[{Args.object}]")
            return 1
        if Args.action == "definition":
            if ObjectType == "VIEW":
                Definition = GetViewDefinition(Cursor, Args.schema, Args.object)
            else:
                Definition = GetTableDefinition(Cursor, Args.schema, Args.object)
            if Args.json:
                WriteJson(
                    {
                        "schema": Args.schema,
                        "object": Args.object,
                        "type": ObjectType,
                        "definition": Definition.strip(),
                    },
                    Args.json_out,
                )
            else:
                print(Definition.strip() or f"-- No definition found for [{Args.schema}].[{Args.object}]")
            return 0

        TopN = ClampTopN(Args.top)
        if Args.json:
            Columns, Rows = FetchData(Cursor, Args.schema, Args.object, TopN)
            WriteJson(
                {
                    "schema": Args.schema,
                    "object": Args.object,
                    "type": ObjectType,
                    "top": TopN,
                    "columns": Columns,
                    "rows": BuildJsonRows(Rows),
                },
                Args.json_out,
            )
        else:
            PrintData(Cursor, Args.schema, Args.object, TopN)
        return 0

    return 0


def Main() -> int:
    Args = ParseArgs()
    LoadEnvFile(Args.env_file)
    ValidateRequiredEnv()

    try:
        with Connect() as Conn:
            Cursor = Conn.cursor()

            if Args.list_schemas or Args.list_objects or Args.action:
                return RunNonInteractive(Cursor, Args)

            while True:
                Schemas = ListSchemas(Cursor)
                SchemaIndex = PromptChoice("Select a schema:", Schemas, AllowBack=False)
                if SchemaIndex is None:
                    return 0

                SchemaName = Schemas[SchemaIndex]

                while True:
                    Objects = ListObjectsInSchema(Cursor, SchemaName)
                    if not Objects:
                        print(f"\nNo tables/views found in schema: {SchemaName}")
                        break

                    Options = [f"{Name} ({ObjType})" for Name, ObjType in Objects]
                    ObjectIndex = PromptChoice(f"Schema: {SchemaName}. Select a table/view:", Options, AllowBack=True)
                    if ObjectIndex is None:
                        return 0
                    if ObjectIndex == -1:
                        break

                    ObjectName, ObjectType = Objects[ObjectIndex]

                    ActionIndex = PromptChoice(
                        f"Object: [{SchemaName}].[{ObjectName}] ({ObjectType}). What do you want?",
                        ["Definition", "Data"],
                        AllowBack=True,
                    )
                    if ActionIndex is None:
                        return 0
                    if ActionIndex == -1:
                        continue

                    print()
                    if ActionIndex == 0:
                        if ObjectType == "VIEW":
                            Definition = GetViewDefinition(Cursor, SchemaName, ObjectName)
                            print(Definition.strip() or f"-- No definition found for [{SchemaName}].[{ObjectName}]")
                        else:
                            Definition = GetTableDefinition(Cursor, SchemaName, ObjectName)
                            print(Definition.strip() or f"-- No definition found for [{SchemaName}].[{ObjectName}]")
                    else:
                        TopText = input(f"TOP N rows to print (default {DEFAULT_TOP_ROWS}): ").strip()
                        TopN = DEFAULT_TOP_ROWS
                        if TopText:
                            try:
                                TopN = ClampTopN(int(TopText))
                            except Exception:
                                TopN = DEFAULT_TOP_ROWS
                        PrintData(Cursor, SchemaName, ObjectName, TopN)

                    input("\nPress Enter to continue...")

    except KeyboardInterrupt:
        return 0
    except Exception as Ex:
        print("\nError:")
        print(textwrap.indent(str(Ex), "  "))
        return 1


if __name__ == "__main__":
    raise SystemExit(Main())
