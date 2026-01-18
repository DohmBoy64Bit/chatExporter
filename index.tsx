import { React, Forms, Text, Button, Alerts, RestAPI, Constants, ChannelStore, SelectedChannelStore, UserStore, SnowflakeUtils, showToast, Toasts } from "@webpack/common";
import { Divider } from "@components/Divider";
import definePlugin, { OptionType, PluginNative } from "@utils/types";
import { Logger } from "@utils/Logger";
import { settings } from "./settings";

const logger = new Logger("ChatExporter");
const Native = VencordNative.pluginHelpers["Chat Exporter"] as PluginNative<typeof import("./native")>;

interface Message {
  id: string;
  content: string;
  author: {
    id: string;
    username: string;
    globalName?: string;
    discriminator: string;
    avatar: string | null;
  };
  timestamp: string;
  editedTimestamp?: string;
  attachments: any[];
  embeds: any[];
  reactions: any[];
  mentions: any[];
  pinned: boolean;
  type: number;
}

async function fetchAllMessages(channelId: string, progressCallback?: (count: number) => void) {
  let allMessages: Message[] = [];
  let before: string | undefined = undefined;
  let totalFetched = 0;
  const limit = settings.store.messageLimit;

  const currentUser = UserStore.getCurrentUser();

  try {
    while (true) {
      if (limit > 0 && totalFetched >= limit) break;

      const res = await RestAPI.get({
        url: Constants.Endpoints.MESSAGES(channelId),
        query: {
          limit: Math.min(100, limit > 0 ? limit - totalFetched : 100),
          before
        }
      });

      if (!res.ok) {
        throw new Error(`Failed to fetch messages: ${res.status}`);
      }

      const batch = res.body;
      if (!batch || batch.length === 0) break;

      const messages: Message[] = batch.map((m: any) => ({
        id: m.id,
        content: m.content || "",
        author: {
          id: m.author?.id || "unknown",
          username: m.author?.username || "Unknown",
          globalName: m.author?.global_name,
          discriminator: m.author?.discriminator || "0000",
          avatar: m.author?.avatar || null
        },
        timestamp: m.timestamp,
        editedTimestamp: m.edited_timestamp,
        attachments: m.attachments?.map((a: any) => ({
          id: a.id,
          filename: a.filename,
          url: a.url,
          size: a.size,
          contentType: a.content_type
        })) || [],
        embeds: m.embeds || [],
        reactions: m.reactions?.map((r: any) => ({
          emoji: r.emoji,
          count: r.count
        })) || [],
        mentions: m.mentions || [],
        pinned: !!m.pinned,
        type: m.type || 0
      }));

      allMessages = [...allMessages, ...messages];
      totalFetched += messages.length;

      progressCallback?.(totalFetched);

      if (messages.length < 100) break;
      before = messages[messages.length - 1].id;

      const delay = (currentUser?.premiumType ?? 0) > 0 ? 200 : 600;
      await new Promise(r => setTimeout(r, delay));
    }
  } catch (error) {
    logger.error("Error fetching messages:", error);
    throw error;
  }

  return allMessages.reverse();
}

function formatFileName(channel: any): string {
  const date = new Date();
  const dateStr = date.toISOString().split('T')[0];

  if (channel.name) {
    return `discord-${channel.name}-${dateStr}`;
  }

  if (channel.recipients?.length) {
    const names = channel.recipients.map((r: any) => r.username).join('-');
    return `discord-dm-${names}-${dateStr}`;
  }

  return `discord-channel-${channel.id}-${dateStr}`;
}

async function handleDownload(name: string, content: string, type: string) {
  const exportPath = settings.store.exportPath;
  if (exportPath && !IS_WEB) {
    const res = await Native.saveFile(exportPath, name, content);
    if (res.ok) {
      showToast(`Saved to ${exportPath}\\${name}`, Toasts.Type.SUCCESS);
    } else {
      showToast(`Failed to save: ${res.error}`, Toasts.Type.FAILURE);
      // Fallback to browser download
      downloadFile(name, content, type);
    }
  } else {
    downloadFile(name, content, type);
  }
}

function downloadFile(name: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function exportToCSV(messages: Message[]) {
  const headers = ["ID", "Timestamp", "Author", "Content", "Attachments", "Reactions"];
  const rows = messages.map(msg => [
    msg.id,
    new Date(msg.timestamp).toISOString(),
    `"${msg.author.username}#${msg.author.discriminator}"`,
    `"${msg.content.replace(/"/g, '""')}"`,
    msg.attachments.length,
    msg.reactions.length
  ]);

  return [headers, ...rows].map(row => row.join(",")).join("\n");
}

export default definePlugin({
  name: "Chat Exporter",
  description: "Export entire channel/group chat to JSON, CSV, or HTML",
  authors: [{ name: "You", id: 123456789n }],
  version: "1.3.0",
  settings,

  start() {
    logger.info("Chat Exporter plugin started");
  },

  stop() {
    logger.info("Chat Exporter plugin stopped");
  },

  toolboxActions: {
    "Export Chat (JSON)": () => {
      const channelId = SelectedChannelStore.getChannelId();
      const channel = ChannelStore.getChannel(channelId);

      if (!channel) {
        Alerts.show({ title: "Error", body: "No channel selected" });
        return;
      }

      Alerts.show({
        title: "Confirm Export",
        body: `Export messages from #${channel.name || "DM"} as JSON?\nThis may take a while.`,
        confirmText: "Export",
        cancelText: "Cancel",
        onConfirm: async () => {
          try {
            showToast("Starting export...", Toasts.Type.MESSAGE);
            const messages = await fetchAllMessages(channelId, (count) => {
              if (count % 500 === 0) showToast(`Fetched ${count} messages...`, Toasts.Type.MESSAGE);
            });
            const data = {
              metadata: {
                version: "2.1",
                exportDate: new Date().toISOString(),
                exporter: "Chat Exporter Plugin"
              },
              channel: {
                id: channel.id,
                name: channel.name,
                type: channel.type
              },
              messages
            };
            await handleDownload(`${formatFileName(channel)}.json`, JSON.stringify(data, null, 2), "application/json");
            Alerts.show({ title: "Success", body: `Successfully exported ${messages.length} messages!` });
          } catch (error) {
            Alerts.show({ title: "Error", body: "Export failed. Check console for details." });
          }
        }
      });
    },

    "Export Chat (CSV)": () => {
      const channelId = SelectedChannelStore.getChannelId();
      const channel = ChannelStore.getChannel(channelId);

      if (!channel) {
        Alerts.show({ title: "Error", body: "No channel selected" });
        return;
      }

      Alerts.show({
        title: "Confirm Export",
        body: `Export messages from #${channel.name || "DM"} as CSV?\nThis may take a while.`,
        confirmText: "Export",
        cancelText: "Cancel",
        onConfirm: async () => {
          try {
            showToast("Starting export...", Toasts.Type.MESSAGE);
            const messages = await fetchAllMessages(channelId, (count) => {
              if (count % 500 === 0) showToast(`Fetched ${count} messages...`, Toasts.Type.MESSAGE);
            });
            const csv = exportToCSV(messages);
            await handleDownload(`${formatFileName(channel)}.csv`, csv, "text/csv");
            Alerts.show({ title: "Success", body: `Successfully exported ${messages.length} messages!` });
          } catch (error) {
            Alerts.show({ title: "Error", body: "Export failed." });
          }
        }
      });
    }
  },

  settingsAboutComponent: () => {
    const [exporting, setExporting] = React.useState(false);
    const [progress, setProgress] = React.useState(0);
    const { exportPath, messageLimit } = settings.use(["exportPath", "messageLimit"]);

    const channelId = SelectedChannelStore.getChannelId();
    const channel = ChannelStore.getChannel(channelId);

    const handleExport = async (format: 'json' | 'csv') => {
      if (!channel) {
        Alerts.show({ title: "Error", body: "No channel selected" });
        return;
      }

      setExporting(true);
      setProgress(0);

      try {
        const messages = await fetchAllMessages(channelId, setProgress);

        if (format === 'json') {
          const data = {
            channel: { id: channel.id, name: channel.name, type: channel.type },
            exportedAt: new Date().toISOString(),
            messages
          };
          await handleDownload(`${formatFileName(channel)}.json`, JSON.stringify(data, null, 2), "application/json");
        } else {
          const csv = exportToCSV(messages);
          await handleDownload(`${formatFileName(channel)}.csv`, csv, "text/csv");
        }

        Alerts.show({ title: "Success", body: `Exported ${messages.length} messages successfully!` });
      } catch (error) {
        Alerts.show({ title: "Error", body: "Export failed: " + error });
      } finally {
        setExporting(false);
      }
    };

    const handleSelectFolder = async () => {
      const path = await Native.selectFolder();
      if (path) {
        settings.store.exportPath = path;
      }
    };

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        <div>
          <Forms.FormTitle>Chat Exporter</Forms.FormTitle>
          <Forms.FormText>
            Export complete chat history from the currently selected channel: <strong>#{channel?.name || "No channel selected"}</strong>
          </Forms.FormText>
        </div>

        <div>
          <Forms.FormTitle tag="h5">Export Path</Forms.FormTitle>
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <Forms.FormText style={{ flex: 1, margin: 0, padding: "8px", background: "var(--background-secondary)", borderRadius: "4px" }}>
              {exportPath || "Not set (downloads to browser default)"}
            </Forms.FormText>
            <Button
              size={Button.Sizes.SMALL}
              onClick={handleSelectFolder}
              disabled={IS_WEB}
            >
              Select Folder
            </Button>
          </div>
        </div>

        {exporting ? (
          <div style={{ margin: "12px 0" }}>
            <Text>Fetching messages... {progress} {messageLimit > 0 ? `/ ${messageLimit}` : ""} fetched</Text>
            <div style={{
              height: "4px",
              background: "var(--background-modifier-accent)",
              borderRadius: "2px",
              marginTop: "8px"
            }}>
              <div style={{
                width: `${messageLimit > 0 ? Math.min((progress / messageLimit) * 100, 100) : 100}%`,
                height: "100%",
                background: "var(--green-360)",
                borderRadius: "2px",
                transition: "width 0.3s"
              }} />
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", gap: "8px" }}>
            <Button
              onClick={() => handleExport('json')}
              color={Button.Colors.BRAND}
              disabled={!channel}
            >
              Export as JSON
            </Button>
            <Button
              onClick={() => handleExport('csv')}
              color={Button.Colors.BRAND}
              disabled={!channel}
            >
              Export as CSV
            </Button>
          </div>
        )}

        <Divider />

        <Forms.FormText style={{ fontSize: "12px", opacity: 0.7 }}>
          • Fetches messages in batches of 100<br />
          • Respects your set message limit ({messageLimit === 0 ? "All" : messageLimit})<br />
          • Works with any channel type<br />
          • Preserves attachments and embeds (as metadata)
        </Forms.FormText>
      </div>
    );
  }
});
