# Chat Exporter for Vencord

A powerful and user-friendly Vencord plugin that allows you to export chat history from any Discord channel or DM directly to your computer.

![Version](https://img.shields.io/badge/version-1.3.0-blue.svg)
![Vencord](https://img.shields.io/badge/Vencord-Plugin-blueviolet.svg)

## 🚀 Features

- **Multiple Formats**: Export chat history to **JSON** (full metadata) or **CSV** (easy to read in Excel/Sheets).
- **Customizable Scope**: Export any channel, group DM, or private message by right-clicking.
- **Message Limits**: Choose to export everything or set a specific limit (e.g., last 1000 messages) via a slider.
- **Native File Saving**: Select a custom folder on your computer to save exports directly, bypassing the browser's download prompt.
- **Real-time Feedback**: Includes a progress bar in settings and **Toast notifications** for long-running exports in the background.
- **Rate-Limit Respectful**: Fetches messages in batches with built-in delays to avoid Discord API rate limits.
- **Detailed Metadata**: Exports include author info, timestamps, message content, attachments, embeds, and reactions.

## 📥 Installation

### As a Userplugin

1.  Clone this repository or download the files.
2.  Navigate to your Vencord source directory.
3.  Copy the `chatExporter` folder into `src/userplugins/`.
4.  Rebuild Vencord:
    ```bash
    pnpm build --dev
    ```
5.  Restart Discord.

## 🛠️ Usage

### Quick Export (Toolbox)
1.  **Right-click** on any channel or DM in your sidebar.
2.  Look for the **Toolbox** section.
3.  Select **Export Chat (JSON)** or **Export Chat (CSV)**.
4.  Confirm the export in the dialog that appears.
5.  Follow the progress via the **Toast notifications** in the bottom-right.

### Advanced Export (Settings)
1.  Go to **Discord Settings** > **Vencord** > **Plugins**.
2.  Search for **Chat Exporter** and click the settings icon (cog).
3.  **Select Folder**: Choose where you want your files saved.
4.  **Message Limit**: Use the slider to set how many messages you want to fetch (Set to 0 for All).
5.  Use the **Export as JSON/CSV** buttons to start the export for the currently selected channel.

## ⚙️ Configuration

- **Export Path**: The directory where your chat exports will be stored automatically.
- **Message Limit**: Controls the depth of the export. Useful for quickly grabbing recent history without fetching years of data.

## 📝 License

This project is licensed under the GPL-3.0 License - see the LICENSE file for details.

---

*Made with ❤️ for the Vencord community.*
