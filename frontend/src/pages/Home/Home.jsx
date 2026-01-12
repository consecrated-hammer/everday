import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import Icon from "../../components/Icon.jsx";
import { GetUserId } from "../../lib/authStorage.js";
import { LoadDashboardLayout, SaveDashboardLayout } from "../../lib/dashboardLayout.js";
import BudgetWidget from "./widgets/BudgetWidget.jsx";
import HealthWidget from "./widgets/HealthWidget.jsx";
import KidsWidget from "./widgets/KidsWidget.jsx";
import ShoppingWidget from "./widgets/ShoppingWidget.jsx";

const SizeOptions = {
  compact: { ColumnSpan: 3, Label: "Compact" },
  wide: { ColumnSpan: 6, Label: "Wide" }
};

const BuildWidgetCatalog = () => [
  {
    Id: "budget",
    Title: "Budget snapshot",
    Component: BudgetWidget,
    DefaultSize: "compact",
    Sizes: ["compact", "wide"],
    NavTo: "/budget/allocations",
    NavLabel: "Budget →"
  },
  {
    Id: "shopping",
    Title: "Shopping list",
    Component: ShoppingWidget,
    DefaultSize: "compact",
    Sizes: ["compact", "wide"],
    NavTo: "/shopping",
    NavLabel: "Shopping →"
  },
  {
    Id: "health",
    Title: "Health trends",
    Component: HealthWidget,
    DefaultSize: "compact",
    Sizes: ["compact", "wide"],
    NavTo: "/health/today",
    NavLabel: "Health →"
  },
  {
    Id: "kids",
    Title: "Kids balances",
    Component: KidsWidget,
    DefaultSize: "compact",
    Sizes: ["compact", "wide"],
    NavTo: "/kids",
    NavLabel: "Kids →"
  }
];

const BuildDefaultLayout = (widgets) =>
  widgets.map((widget) => ({
    Id: widget.Id,
    Size: widget.DefaultSize || "compact"
  }));

const MergeDashboardLayout = (storedLayout, defaultLayout, widgetMap) => {
  const next = [];
  const defaultMap = new Map(defaultLayout.map((item) => [item.Id, item]));

  if (Array.isArray(storedLayout)) {
    storedLayout.forEach((item) => {
      const base = defaultMap.get(item.Id);
      if (!base) {
        return;
      }
      const widget = widgetMap.get(item.Id);
      const sizes = widget?.Sizes || [];
      const size = sizes.includes(item.Size) ? item.Size : base.Size;
      next.push({ ...base, Size: size });
      defaultMap.delete(item.Id);
    });
  }

  defaultMap.forEach((item) => next.push(item));
  return next;
};

const SwapLayoutItems = (layout, sourceId, targetId) => {
  const sourceIndex = layout.findIndex((item) => item.Id === sourceId);
  const targetIndex = layout.findIndex((item) => item.Id === targetId);
  if (sourceIndex === -1 || targetIndex === -1 || sourceIndex === targetIndex) {
    return layout;
  }
  const next = [...layout];
  const temp = next[sourceIndex];
  next[sourceIndex] = next[targetIndex];
  next[targetIndex] = temp;
  return next;
};

const MoveLayoutItem = (layout, widgetId, direction) => {
  const index = layout.findIndex((item) => item.Id === widgetId);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= layout.length) {
    return layout;
  }
  const next = [...layout];
  const temp = next[index];
  next[index] = next[target];
  next[target] = temp;
  return next;
};

const NextSize = (currentSize, sizes) => {
  if (!sizes || sizes.length <= 1) {
    return currentSize;
  }
  const index = sizes.indexOf(currentSize);
  const nextIndex = index === -1 ? 0 : (index + 1) % sizes.length;
  return sizes[nextIndex];
};

const Home = () => {
  const userId = GetUserId();
  const [layout, setLayout] = useState([]);
  const [layoutReady, setLayoutReady] = useState(false);
  const [draggingId, setDraggingId] = useState(null);
  const [dropTargetId, setDropTargetId] = useState(null);

  const widgets = useMemo(() => BuildWidgetCatalog(), []);
  const widgetMap = useMemo(() => new Map(widgets.map((widget) => [widget.Id, widget])), [widgets]);

  useEffect(() => {
    if (layoutReady) {
      return;
    }
    const storedLayout = LoadDashboardLayout(userId);
    const defaultLayout = BuildDefaultLayout(widgets);
    setLayout(MergeDashboardLayout(storedLayout, defaultLayout, widgetMap));
    setLayoutReady(true);
  }, [layoutReady, userId, widgetMap, widgets]);

  useEffect(() => {
    if (!layoutReady) {
      return;
    }
    const defaultLayout = BuildDefaultLayout(widgets);
    setLayout((prev) => MergeDashboardLayout(prev, defaultLayout, widgetMap));
  }, [layoutReady, widgetMap, widgets]);

  useEffect(() => {
    if (!layoutReady) {
      return;
    }
    SaveDashboardLayout(userId, layout);
  }, [layout, layoutReady, userId]);

  const onDragStart = (widgetId) => (event) => {
    event.dataTransfer.setData("text/plain", widgetId);
    event.dataTransfer.effectAllowed = "move";
    setDraggingId(widgetId);
  };

  const onDragOver = (widgetId) => (event) => {
    event.preventDefault();
    if (widgetId !== draggingId) {
      setDropTargetId(widgetId);
    }
  };

  const onDrop = (widgetId) => (event) => {
    event.preventDefault();
    const sourceId = draggingId || event.dataTransfer.getData("text/plain");
    if (!sourceId || sourceId === widgetId) {
      return;
    }
    setLayout((prev) => SwapLayoutItems(prev, sourceId, widgetId));
    setDraggingId(null);
    setDropTargetId(null);
  };

  const onDragEnd = () => {
    setDraggingId(null);
    setDropTargetId(null);
  };

  const onResize = (widgetId) => {
    setLayout((prev) =>
      prev.map((item) => {
        if (item.Id !== widgetId) {
          return item;
        }
        const sizes = widgetMap.get(widgetId)?.Sizes || [];
        return { ...item, Size: NextSize(item.Size, sizes) };
      })
    );
  };

  const onMove = (widgetId, direction) => {
    setLayout((prev) => MoveLayoutItem(prev, widgetId, direction));
  };

  if (!layoutReady) {
    return (
      <div className="app-shell app-shell--wide dashboard">
        <p className="form-note">Loading dashboard...</p>
      </div>
    );
  }

  return (
    <div className="app-shell app-shell--wide dashboard">
      <section className="dashboard-grid" aria-label="Dashboard widgets">
        {layout.map((item, index) => {
          const widget = widgetMap.get(item.Id);
          if (!widget) {
            return null;
          }
          const WidgetComponent = widget.Component;
          const isDragging = draggingId === item.Id;
          const isDropTarget = dropTargetId === item.Id;
          const size = SizeOptions[item.Size] || SizeOptions.compact;
          const nextSize = NextSize(item.Size, widget.Sizes || []);
          const resizeLabel = nextSize === "wide" ? "Expand" : "Compact";
          return (
            <article
              key={item.Id}
              className={`dashboard-widget dashboard-widget--${item.Id}${
                isDragging ? " is-dragging" : ""
              }${isDropTarget ? " is-drop-target" : ""}`}
              style={{ "--widget-span": size.ColumnSpan }}
              data-size={item.Size}
              onDragOver={onDragOver(item.Id)}
              onDrop={onDrop(item.Id)}
            >
              <header className="widget-header">
                <div>
                  <h2 className="widget-title">{widget.Title}</h2>
                </div>
                <div className="widget-actions">
                  {widget.NavTo ? (
                    <Link className="widget-nav-link" to={widget.NavTo}>
                      {widget.NavLabel || "Open →"}
                    </Link>
                  ) : null}
                  <button
                    type="button"
                    className="widget-icon-button widget-drag-handle"
                    draggable
                    onDragStart={onDragStart(item.Id)}
                    onDragEnd={onDragEnd}
                    aria-label={`Move ${widget.Title}`}
                    aria-grabbed={isDragging}
                  >
                    <Icon name="drag" className="icon" />
                  </button>
                  {widget.Sizes?.length > 1 ? (
                    <button
                      type="button"
                      className="widget-action-button"
                      onClick={() => onResize(item.Id)}
                    >
                      {resizeLabel}
                    </button>
                  ) : null}
                  <div className="widget-reorder">
                    <button
                      type="button"
                      className="widget-icon-button"
                      onClick={() => onMove(item.Id, -1)}
                      aria-label={`Move ${widget.Title} up`}
                      disabled={index === 0}
                    >
                      <Icon name="sortUp" className="icon" />
                    </button>
                    <button
                      type="button"
                      className="widget-icon-button"
                      onClick={() => onMove(item.Id, 1)}
                      aria-label={`Move ${widget.Title} down`}
                      disabled={index === layout.length - 1}
                    >
                      <Icon name="sortDown" className="icon" />
                    </button>
                  </div>
                </div>
              </header>
              <WidgetComponent
                {...(widget.Props || {})}
                IsExpanded={item.Size === "wide"}
                LayoutSize={item.Size}
              />
            </article>
          );
        })}
      </section>
    </div>
  );
};

export default Home;
