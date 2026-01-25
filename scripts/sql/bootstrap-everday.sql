:setvar DatabaseName "Everday"
:setvar AppLoginName "everday_app"
:setvar AppUserName "everday_app"
:setvar AppLoginPassword "ChangeMe_DevOnly!"
:setvar AppRoleName "EverdayCrud"

IF DB_ID('$(DatabaseName)') IS NULL
BEGIN
  EXEC('CREATE DATABASE [' + '$(DatabaseName)' + ']');
END
GO

USE [$(DatabaseName)];
GO

IF NOT EXISTS (SELECT 1 FROM sys.schemas WHERE name = 'auth')
  EXEC('CREATE SCHEMA [auth]');
IF NOT EXISTS (SELECT 1 FROM sys.schemas WHERE name = 'budget')
  EXEC('CREATE SCHEMA [budget]');
IF NOT EXISTS (SELECT 1 FROM sys.schemas WHERE name = 'health')
  EXEC('CREATE SCHEMA [health]');
IF NOT EXISTS (SELECT 1 FROM sys.schemas WHERE name = 'tasks')
  EXEC('CREATE SCHEMA [tasks]');
IF NOT EXISTS (SELECT 1 FROM sys.schemas WHERE name = 'agenda')
  EXEC('CREATE SCHEMA [agenda]');
IF NOT EXISTS (SELECT 1 FROM sys.schemas WHERE name = 'files')
  EXEC('CREATE SCHEMA [files]');
IF NOT EXISTS (SELECT 1 FROM sys.schemas WHERE name = 'ai')
  EXEC('CREATE SCHEMA [ai]');
IF NOT EXISTS (SELECT 1 FROM sys.schemas WHERE name = 'ref')
  EXEC('CREATE SCHEMA [ref]');
GO

USE [master];
GO

IF EXISTS (SELECT 1 FROM sys.server_principals WHERE name = '$(AppLoginName)')
BEGIN
  ALTER LOGIN [$(AppLoginName)] WITH PASSWORD = N'$(AppLoginPassword)', CHECK_POLICY = OFF, DEFAULT_DATABASE = [$(DatabaseName)];
END
ELSE
BEGIN
  CREATE LOGIN [$(AppLoginName)] WITH PASSWORD = N'$(AppLoginPassword)', CHECK_POLICY = OFF, DEFAULT_DATABASE = [$(DatabaseName)];
END
GO

USE [$(DatabaseName)];
GO

IF EXISTS (SELECT 1 FROM sys.database_principals WHERE name = '$(AppUserName)')
BEGIN
  ALTER USER [$(AppUserName)] WITH LOGIN = [$(AppLoginName)], DEFAULT_SCHEMA = [auth];
END
ELSE
BEGIN
  CREATE USER [$(AppUserName)] FOR LOGIN [$(AppLoginName)] WITH DEFAULT_SCHEMA = [auth];
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.database_principals WHERE [type] = 'R' AND [name] = '$(AppRoleName)')
BEGIN
  CREATE ROLE [$(AppRoleName)];
END
GO

IF IS_ROLEMEMBER('$(AppRoleName)', '$(AppUserName)') <> 1
BEGIN
  ALTER ROLE [$(AppRoleName)] ADD MEMBER [$(AppUserName)];
END
GO

GRANT SELECT, INSERT, UPDATE, DELETE ON SCHEMA::[auth] TO [$(AppRoleName)];
GRANT SELECT, INSERT, UPDATE, DELETE ON SCHEMA::[budget] TO [$(AppRoleName)];
GRANT SELECT, INSERT, UPDATE, DELETE ON SCHEMA::[health] TO [$(AppRoleName)];
GRANT SELECT, INSERT, UPDATE, DELETE ON SCHEMA::[tasks] TO [$(AppRoleName)];
GRANT SELECT, INSERT, UPDATE, DELETE ON SCHEMA::[agenda] TO [$(AppRoleName)];
GRANT SELECT, INSERT, UPDATE, DELETE ON SCHEMA::[files] TO [$(AppRoleName)];
GRANT SELECT, INSERT, UPDATE, DELETE ON SCHEMA::[ai] TO [$(AppRoleName)];
GRANT SELECT ON SCHEMA::[ref] TO [$(AppRoleName)];
DENY ALTER, CONTROL, TAKE OWNERSHIP ON SCHEMA::[dbo] TO [$(AppRoleName)];
GO
