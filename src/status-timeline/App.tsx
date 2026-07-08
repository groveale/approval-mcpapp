// src/status-timeline/App.tsx — Status Timeline Widget
import { App } from "@modelcontextprotocol/ext-apps";
import {
  FluentProvider,
  webLightTheme,
  webDarkTheme,
  Card,
  CardHeader,
  Text,
  Badge,
  Button,
  Spinner,
  Divider,
  makeStyles,
  tokens,
} from "@fluentui/react-components";
import {
  CheckmarkCircle20Filled,
  Circle20Regular,
  Clock20Regular,
  DismissCircle20Filled,
  ArrowRight20Regular,
  Timeline20Regular,
  FullScreenMaximize24Regular,
  FullScreenMinimize24Regular,
} from "@fluentui/react-icons";
import { createRoot } from "react-dom/client";
import { useState, useEffect, useCallback } from "react";

// ─── Types ───────────────────────────────────────────────────────────
interface TimelineEntry {
  stage: string;
  status: "completed" | "current" | "pending" | "rejected";
  actor?: string;
  comment?: string;
  timestamp: string;
}

interface AccessRequest {
  id: string;
  employeeName: string;
  employeeEmail: string;
  system: string;
  role: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  timeline: TimelineEntry[];
}

interface StatusData {
  requests: AccessRequest[];
  error?: string;
}

// ─── Styles ──────────────────────────────────────────────────────────
const useStyles = makeStyles({
  root: {
    padding: tokens.spacingVerticalL,
    backgroundColor: tokens.colorNeutralBackground1,
    minHeight: "100%",
    overflowY: "auto",
  },
  header: {
    display: "flex",
    alignItems: "center",
    gap: tokens.spacingHorizontalS,
    marginBottom: tokens.spacingVerticalL,
  },
  card: {
    marginBottom: tokens.spacingVerticalM,
    padding: tokens.spacingVerticalM,
  },
  requestSummary: {
    display: "flex",
    flexWrap: "wrap",
    gap: tokens.spacingHorizontalS,
    alignItems: "center",
    marginBottom: tokens.spacingVerticalS,
  },
  timeline: {
    position: "relative",
    paddingLeft: "28px",
    marginTop: tokens.spacingVerticalM,
  },
  timelineTrack: {
    position: "absolute",
    left: "9px",
    top: "0",
    bottom: "0",
    width: "2px",
    backgroundColor: tokens.colorNeutralStroke2,
  },
  timelineItem: {
    position: "relative",
    paddingBottom: tokens.spacingVerticalM,
    "&:last-child": {
      paddingBottom: "0",
    },
  },
  timelineIcon: {
    position: "absolute",
    left: "-28px",
    top: "0",
    width: "20px",
    height: "20px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: tokens.colorNeutralBackground1,
    zIndex: 1,
  },
  timelineContent: {
    paddingLeft: tokens.spacingHorizontalS,
  },
  timelineRow: {
    display: "flex",
    alignItems: "center",
    gap: tokens.spacingHorizontalXS,
  },
  actorComment: {
    marginTop: tokens.spacingVerticalXXS,
    color: tokens.colorNeutralForeground3,
  },
  empty: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: tokens.spacingVerticalM,
    padding: tokens.spacingVerticalXXL,
    color: tokens.colorNeutralForeground3,
  },
  loading: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    height: "200px",
  },
});

// ─── Timeline Step Icon ──────────────────────────────────────────────
function StepIcon({ status }: { status: TimelineEntry["status"] }) {
  switch (status) {
    case "completed":
      return (
        <CheckmarkCircle20Filled
          style={{ color: tokens.colorPaletteGreenForeground1 }}
        />
      );
    case "current":
      return (
        <Clock20Regular
          style={{ color: tokens.colorPaletteBlueForeground2 }}
        />
      );
    case "rejected":
      return (
        <DismissCircle20Filled
          style={{ color: tokens.colorPaletteRedForeground1 }}
        />
      );
    case "pending":
    default:
      return (
        <Circle20Regular style={{ color: tokens.colorNeutralStroke2 }} />
      );
  }
}

// ─── Single Request Timeline Card ────────────────────────────────────
function RequestTimelineCard({ request }: { request: AccessRequest }) {
  const styles = useStyles();

  const overallStatusColor = (status: string) => {
    switch (status) {
      case "Granted":
        return "success" as const;
      case "Rejected":
        return "danger" as const;
      case "Manager Review":
      case "IT Review":
        return "warning" as const;
      default:
        return "brand" as const;
    }
  };

  const stepBadgeColor = (status: TimelineEntry["status"]) => {
    switch (status) {
      case "completed":
        return "success" as const;
      case "current":
        return "informative" as const;
      case "rejected":
        return "danger" as const;
      default:
        return "subtle" as const;
    }
  };

  return (
    <Card className={styles.card}>
      <CardHeader
        header={
          <Text weight="bold" size={400}>
            {request.id}
          </Text>
        }
        description={
          <div className={styles.requestSummary}>
            <Text size={200}>{request.employeeName}</Text>
            <ArrowRight20Regular style={{ fontSize: "12px" }} />
            <Text size={200} weight="semibold">
              {request.system}
            </Text>
            <Badge appearance="outline" size="small">
              {request.role}
            </Badge>
            <Badge
              appearance="filled"
              color={overallStatusColor(request.status)}
            >
              {request.status}
            </Badge>
          </div>
        }
      />

      <Divider style={{ margin: `${tokens.spacingVerticalXS} 0` }} />

      <div className={styles.timeline}>
        <div className={styles.timelineTrack} />
        {request.timeline.map((entry, idx) => (
          <div key={idx} className={styles.timelineItem}>
            <div className={styles.timelineIcon}>
              <StepIcon status={entry.status} />
            </div>
            <div className={styles.timelineContent}>
              <div className={styles.timelineRow}>
                <Text weight="semibold" size={300}>
                  {entry.stage}
                </Text>
                <Badge
                  appearance="tint"
                  size="small"
                  color={stepBadgeColor(entry.status)}
                >
                  {entry.status}
                </Badge>
              </div>
              {entry.actor && (
                <Text className={styles.actorComment} size={200}>
                  {entry.actor}
                  {entry.comment ? ` — ${entry.comment}` : ""}
                </Text>
              )}
              {entry.timestamp && (
                <Text
                  size={100}
                  style={{ color: tokens.colorNeutralForeground4 }}
                >
                  {new Date(entry.timestamp).toLocaleString()}
                </Text>
              )}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

// ─── Main Widget ─────────────────────────────────────────────────────
function StatusTimelineWidget() {
  const styles = useStyles();
  const [appInstance] = useState(
    () => new App({ name: "Access Status Timeline", version: "1.0.0" }),
  );
  const [data, setData] = useState<StatusData | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Track browser fullscreen changes (fallback path)
  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  const toggleFullscreen = useCallback(async () => {
    try {
      if (appInstance) {
        await appInstance.requestDisplayMode({
          mode: isFullscreen ? "inline" : "fullscreen",
        });
        setIsFullscreen(!isFullscreen);
        return;
      }
    } catch {
      /* not available */
    }
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
        return;
      } else {
        await document.exitFullscreen();
        return;
      }
    } catch {
      /* blocked by sandbox or not supported */
    }
    setIsFullscreen((prev) => !prev);
  }, [appInstance, isFullscreen]);

  useEffect(() => {
    appInstance.ontoolresult = (result) => {
      if (result.structuredContent) {
        setData(result.structuredContent as unknown as StatusData);
      }
    };
    appInstance.connect();
  }, [appInstance]);

  if (!data) {
    return (
      <div className={styles.loading}>
        <Spinner label="Loading status..." />
      </div>
    );
  }

  if (data.error === "not_found") {
    return (
      <div className={styles.empty}>
        <Text size={400}>Request not found</Text>
      </div>
    );
  }

  if (!data.requests || data.requests.length === 0) {
    return (
      <div className={styles.empty}>
        <Timeline20Regular style={{ fontSize: "32px" }} />
        <Text size={400} weight="semibold">
          No requests found
        </Text>
      </div>
    );
  }

  return (
    <div
      className={styles.root}
      style={
        isFullscreen
          ? {
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 9999,
              overflowY: "auto",
            }
          : undefined
      }
    >
      <div className={styles.header}>
        <Timeline20Regular />
        <Text size={500} weight="bold">
          Access Request Status
        </Text>
        <Badge appearance="filled" color="brand">
          {data.requests.length} request(s)
        </Badge>
        <Button
          appearance="subtle"
          icon={
            isFullscreen ? (
              <FullScreenMinimize24Regular />
            ) : (
              <FullScreenMaximize24Regular />
            )
          }
          onClick={toggleFullscreen}
          title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
          style={{ marginLeft: "auto" }}
        />
      </div>

      {data.requests.map((req) => (
        <RequestTimelineCard key={req.id} request={req} />
      ))}
    </div>
  );
}

// ─── Theme Detection & Render ────────────────────────────────────────
function Root() {
  const [isDark, setIsDark] = useState(
    window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false,
  );

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e: MediaQueryListEvent) => setIsDark(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  return (
    <FluentProvider theme={isDark ? webDarkTheme : webLightTheme}>
      <StatusTimelineWidget />
    </FluentProvider>
  );
}

createRoot(document.getElementById("root")!).render(<Root />);