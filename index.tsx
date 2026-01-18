import { React, Forms, Text, Button, TextInput, Select, Slider, Alerts, RestAPI, Constants, ChannelStore, SelectedChannelStore, UserStore, SnowflakeUtils, showToast, Toasts } from "@webpack/common";
import { Divider } from "@components/Divider";
import { FormSwitch } from "@components/FormSwitch";
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
  const { filterStartDate, filterEndDate, filterUserId } = settings.store;

  const currentUser = UserStore.getCurrentUser();

  // Convert dates to snowflakes if provided
  let afterSnowflake: string | undefined = undefined;
  let beforeSnowflake: string | undefined = undefined;

  if (filterStartDate && SnowflakeUtils) {
    try {
      const startTimestamp = new Date(filterStartDate).getTime();
      if (!isNaN(startTimestamp)) afterSnowflake = SnowflakeUtils.fromTimestamp(startTimestamp);
    } catch (err) {
      logger.error("Failed to convert start date to snowflake:", err);
    }
  }

  if (filterEndDate && SnowflakeUtils) {
    try {
      const endTimestamp = new Date(filterEndDate).getTime();
      if (!isNaN(endTimestamp)) beforeSnowflake = SnowflakeUtils.fromTimestamp(endTimestamp);
    } catch (err) {
      logger.error("Failed to convert end date to snowflake:", err);
    }
  }

  try {
    while (true) {
      if (limit > 0 && totalFetched >= limit) break;

      const query: any = {
        limit: Math.floor(Math.min(100, limit > 0 ? limit - totalFetched : 100))
      };

      if (before) {
        query.before = before;
      } else if (beforeSnowflake) {
        query.before = beforeSnowflake;
      }

      if (afterSnowflake) {
        query.after = afterSnowflake;
      }

      logger.debug("Fetching messages with query:", query);

      const res = await RestAPI.get({
        url: Constants.Endpoints.MESSAGES(channelId),
        query
      });

      if (!res.ok) {
        throw new Error(`Failed to fetch messages: ${res.status}`);
      }

      const batch = res.body;
      if (!batch || batch.length === 0) break;

      const messages: Message[] = batch
        .map((m: any) => ({
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
        }))
        // Filter by User ID if set
        .filter((m: Message) => !filterUserId || m.author.id === filterUserId);

      allMessages = [...allMessages, ...messages];
      totalFetched += messages.length;

      progressCallback?.(totalFetched);

      if (batch.length < 100) break;
      before = batch[batch.length - 1].id;

      // If we've reached or gone past the 'after' snowflake, we can stop
      if (afterSnowflake && before && BigInt(before) <= BigInt(afterSnowflake)) break;

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

async function handleDownload(name: string, content: string, type: string, messages?: Message[]) {
  const exportPath = settings.store.exportPath;
  const shouldDownloadMedia = settings.store.downloadMedia;

  if (exportPath && typeof exportPath === "string" && !IS_WEB) {
    // Phase 3: Create a unique subfolder for this export
    const folderName = name.replace(/\.(json|csv|html)$/, "");
    const subfolderPath = exportPath + "/" + folderName;

    // Save the manifest file (JSON/CSV/HTML) inside the subfolder
    const res = await Native.saveFile(subfolderPath, name, content);
    if (res.ok) {
      showToast(`Saved ${name} to ${subfolderPath}`, Toasts.Type.SUCCESS);

      // Handle Media Downloading
      if (shouldDownloadMedia && messages) {
        const attachments = messages.flatMap(m => m.attachments.map(a => ({ ...a, messageId: m.id })));
        if (attachments.length > 0) {
          showToast(`Downloading ${attachments.length} attachments...`, Toasts.Type.MESSAGE);
          const mediaFolder = "attachments";

          for (let i = 0; i < attachments.length; i++) {
            const a = attachments[i];
            try {
              const fileRes = await fetch(a.url);
              if (fileRes.ok) {
                const buffer = await fileRes.arrayBuffer();
                const fileName = `${a.messageId}_${a.filename}`;
                await Native.saveFile(`${subfolderPath}/${mediaFolder}`, fileName, new Uint8Array(buffer));
              }
            } catch (err) {
              logger.error(`Failed to download attachment ${a.filename}:`, err);
            }
            if ((i + 1) % 10 === 0) showToast(`Downloaded ${i + 1}/${attachments.length} items...`, Toasts.Type.MESSAGE);
          }
          showToast("Media download complete!", Toasts.Type.SUCCESS);
        }
      }
    } else {
      showToast(`Failed to save: ${res.error}`, Toasts.Type.FAILURE);
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

function exportToHTML(channel: any, messages: Message[]) {
  const channelName = channel.name || "Direct Message";
  const date = new Date().toLocaleString();

  const messageHTML = messages.map(msg => {
    const time = new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const fullDate = new Date(msg.timestamp).toLocaleDateString();
    const avatarUrl = msg.author.avatar
      ? `https://cdn.discordapp.com/avatars/${msg.author.id}/${msg.author.avatar}.webp`
      : `https://cdn.discordapp.com/embed/avatars/${parseInt(msg.author.id) % 5}.png`;

    return `
      <div class="message">
        <img class="avatar" src="${avatarUrl}" alt="Avatar">
        <div class="msg-content">
          <div class="msg-header">
            <span class="author">${msg.author.globalName || msg.author.username}</span>
            <span class="timestamp" title="${fullDate}">${time}</span>
          </div>
          <div class="text">${msg.content || ""}</div>
          ${msg.attachments.map(a => `
            <div class="attachment">
              ${a.contentType?.startsWith('image/')
        ? `<img src="${a.url}" style="max-width: 400px; max-height: 400px; border-radius: 8px; margin-top: 8px;">`
        : `<a href="${a.url}" target="_blank">File: ${a.filename}</a>`}
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }).join('');

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>Export - #${channelName}</title>
      <style>
        body { background: #313338; color: #dbdee1; font-family: 'gg sans', 'Noto Sans', sans-serif; margin: 0; padding: 20px; line-height: 1.375; }
        .container { max-width: 1000px; margin: 0 auto; }
        .channel-header { border-bottom: 1px solid #3f4147; padding-bottom: 10px; margin-bottom: 20px; }
        .channel-name { font-size: 24px; font-weight: 600; color: #fff; }
        .export-info { font-size: 12px; color: #949ba4; }
        .message { display: flex; padding: 2px 0; margin: 15px 0; }
        .message:hover { background: #2e3035; }
        .avatar { width: 40px; height: 40px; border-radius: 50%; margin-right: 16px; margin-top: 3px; }
        .msg-content { flex: 1; }
        .msg-header { margin-bottom: 2px; }
        .author { font-weight: 500; color: #fff; margin-right: 8px; cursor: pointer; }
        .author:hover { text-decoration: underline; }
        .timestamp { font-size: 12px; color: #949ba4; cursor: default; }
        .text { white-space: pre-wrap; word-wrap: break-word; font-size: 16px; }
        .attachment { margin-top: 5px; }
        .attachment a { color: #00a8fc; text-decoration: none; }
        .attachment a:hover { text-decoration: underline; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="channel-header">
          <div class="channel-name">#${channelName}</div>
          <div class="export-info">Exported on ${date} • ${messages.length} messages</div>
        </div>
        ${messageHTML}
      </div>
    </body>
    </html>
  `;
}

export default definePlugin({
  name: "Chat Exporter",
  description: "Export entire channel/group chat to JSON, CSV, or HTML",
  authors: [{ name: "You", id: 123456789n }],
  version: "1.3.0",
  settings,
  css: `
    @keyframes exporter-pulse {
      0% { opacity: 0.4; }
      50% { opacity: 1; }
      100% { opacity: 0.4; }
    }
    .exporter-pulsing {
      animation: exporter-pulse 1.5s infinite ease-in-out;
    }
  `,

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
            await handleDownload(`${formatFileName(channel)}.json`, JSON.stringify(data, null, 2), "application/json", messages);
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
            await handleDownload(`${formatFileName(channel)}.csv`, csv, "text/csv", messages);
            Alerts.show({ title: "Success", body: `Successfully exported ${messages.length} messages!` });
          } catch (error) {
            Alerts.show({ title: "Error", body: "Export failed." });
          }
        }
      });
    },

    "Export Chat (HTML)": () => {
      const channelId = SelectedChannelStore.getChannelId();
      const channel = ChannelStore.getChannel(channelId);

      if (!channel) {
        Alerts.show({ title: "Error", body: "No channel selected" });
        return;
      }

      Alerts.show({
        title: "Confirm Export",
        body: `Export messages from #${channel.name || "DM"} as HTML?\nThis will create a viewable file that looks like Discord.`,
        confirmText: "Export",
        cancelText: "Cancel",
        onConfirm: async () => {
          try {
            showToast("Starting export...", Toasts.Type.MESSAGE);
            const messages = await fetchAllMessages(channelId, (count) => {
              if (count % 500 === 0) showToast(`Fetched ${count} messages...`, Toasts.Type.MESSAGE);
            });
            const html = exportToHTML(channel, messages);
            await handleDownload(`${formatFileName(channel)}.html`, html, "text/html", messages);
            Alerts.show({ title: "Success", body: `Successfully exported ${messages.length} messages!` });
          } catch (error: any) {
            logger.error("Export failed:", error);
            const errorMsg = error?.message || (typeof error === 'object' ? JSON.stringify(error) : String(error));
            Alerts.show({
              title: "Export Failed",
              body: "Export failed: " + errorMsg,
              confirmText: "Close"
            });
          }
        }
      });
    }
  },

  settingsAboutComponent: () => {
    const [exporting, setExporting] = React.useState(false);
    const [progress, setProgress] = React.useState(0);
    const [format, setFormat] = React.useState<'json' | 'csv' | 'html'>('json');
    const { exportPath, messageLimit, downloadMedia, filterStartDate, filterEndDate, filterUserId } = settings.use([
      "exportPath", "messageLimit", "downloadMedia", "filterStartDate", "filterEndDate", "filterUserId"
    ]);

    const channelId = SelectedChannelStore.getChannelId();
    const channel = ChannelStore.getChannel(channelId);

    const handleExport = async (format: 'json' | 'csv' | 'html') => {
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
          await handleDownload(`${formatFileName(channel)}.json`, JSON.stringify(data, null, 2), "application/json", messages);
        } else if (format === 'csv') {
          const csv = exportToCSV(messages);
          await handleDownload(`${formatFileName(channel)}.csv`, csv, "text/csv", messages);
        } else {
          const html = exportToHTML(channel, messages);
          await handleDownload(`${formatFileName(channel)}.html`, html, "text/html", messages);
        }

        Alerts.show({ title: "Success", body: `Exported ${messages.length} messages successfully!` });
      } catch (error: any) {
        logger.error("Export failed:", error);
        const errorMsg = error?.message || (typeof error === 'object' ? JSON.stringify(error) : String(error));
        Alerts.show({ title: "Error", body: "Export failed: " + errorMsg });
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
              <div
                className={messageLimit === 0 ? "exporter-pulsing" : ""}
                style={{
                  width: `${messageLimit > 0 ? Math.min((progress / messageLimit) * 100, 100) : 100}%`,
                  height: "100%",
                  background: "var(--green-360)",
                  borderRadius: "2px",
                  transition: "width 0.3s"
                }}
              />
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", gap: "8px", alignItems: "flex-end" }}>
            <div style={{ flex: 1 }}>
              <Forms.FormTitle tag="h5">Select Format</Forms.FormTitle>
              <Select
                options={[
                  { label: "JSON (Complete Metadata)", value: "json" },
                  { label: "CSV (Excel/Sheets)", value: "csv" },
                  { label: "HTML (Discord-like view)", value: "html" }
                ]}
                isSelected={v => v === format}
                select={v => setFormat(v as any)}
                serialize={v => v}
              />
            </div>
            <Button
              onClick={() => handleExport(format)}
              color={Button.Colors.BRAND}
              disabled={!channel}
              style={{ padding: "10px 24px" }}
            >
              Export
            </Button>
          </div>
        )}

        <Divider />

        <div>
          <Forms.FormTitle tag="h5">Quick Date Presets</Forms.FormTitle>
          <div style={{ display: "flex", gap: "8px", marginBottom: "12px" }}>
            {[
              { label: "Today", days: 0 },
              { label: "7 Days", days: 7 },
              { label: "30 Days", days: 30 },
              { label: "All Time", days: -1 }
            ].map(p => (
              <Button
                key={p.label}
                size={Button.Sizes.SMALL}
                color={Button.Colors.PRIMARY}
                onClick={() => {
                  if (p.days === -1) {
                    settings.store.filterStartDate = "";
                    settings.store.filterEndDate = "";
                  } else {
                    const end = new Date();
                    const start = new Date();
                    start.setDate(end.getDate() - p.days);
                    settings.store.filterStartDate = start.toISOString().split('T')[0];
                    settings.store.filterEndDate = end.toISOString().split('T')[0];
                  }
                }}
              >
                {p.label}
              </Button>
            ))}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div>
              <Forms.FormTitle tag="h5">Start Date</Forms.FormTitle>
              <TextInput
                type="date"
                value={filterStartDate}
                onChange={v => settings.store.filterStartDate = v}
              />
            </div>
            <div>
              <Forms.FormTitle tag="h5">End Date</Forms.FormTitle>
              <TextInput
                type="date"
                value={filterEndDate}
                onChange={v => settings.store.filterEndDate = v}
              />
            </div>
          </div>
        </div>

        <div>
          <Forms.FormTitle tag="h5">Only from User (ID)</Forms.FormTitle>
          <TextInput
            placeholder="Discord User ID"
            value={filterUserId}
            onChange={v => settings.store.filterUserId = v}
          />
        </div>

        <Divider />

      </div>
    );
  }
});
