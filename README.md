# Chat Exporter for Vencord

A powerful and user-friendly Vencord plugin that allows you to export chat history from any Discord channel or DM directly to your computer.

![Version](https://img.shields.io/badge/version-1.3.0-blue.svg)
![Vencord](https://img.shields.io/badge/Vencord-Plugin-blueviolet.svg)

## 🚀 Features

- **Multiple Formats**: Export chat history to **JSON** (full metadata), **CSV**, or **HTML** (Discord-like view).
- **Discord-like HTML**: Standalone HTML files that look exactly like the Discord app, complete with dark mode and avatars.
- **Media Downloader**: Option to download all attachments (images, videos, files) locally into an `attachments/` folder.
- **Automatic Organization**: Each export automatically creates its own dated subfolder (e.g., `General_2024-01-18`) to keep files and media neatly separated.
- **Advanced Filtering**: Filter exports by **Date Range** (Native calendar pickers & quick presets) or a specific **User ID**.
- **Customizable Scope**: Export any channel, group DM, or private message by right-clicking.
- **Message Limits**: Choose to export everything or set a specific limit (e.g., last 1000 messages) via a dedicated input box.
- **Native File Saving**: Select a custom folder on your computer to save exports directly, bypassing the browser's download prompt.
- **Real-time Feedback**: Includes a progress bar in settings and **Toast notifications** for long-running exports in the background.
- **Rate-Limit Respectful**: Fetches messages in batches with built-in delays to avoid Discord API rate limits.
- **Detailed Metadata**: Exports include author info, timestamps, message content, attachments, embeds, and reactions.
- **Universal Media Downloader**: Automatically saves images, videos, audio, and documents (PDF, ZIP, etc.) from message attachments.

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
> [!IMPORTANT]
> To use Quick Export, you must have the built-in **Toolbox** plugin enabled in Vencord (Settings > Vencord > Plugins > VencordToolbox).

1.  **Click On** on any channel or DM in your sidebar.
2.  In the upper right-hand corner look for the **Toolbox** icon.
3.  Select **Export Chat (JSON)**, **(CSV)**, or **(HTML)**.
4.  Confirm the export in the dialog that appears.
5.  Follow the progress via the **Toast notifications** in the **Top** middle.

### Advanced Export (Settings)
1.  Go to **Discord Settings** > **Vencord** > **Plugins**.
2.  Search for **Chat Exporter** and click the settings icon (cog).
3.  **Select Folder**: Choose where you want your files saved.
4.  **Message Limit**: Enter how many messages you want to fetch in the input box (Set to 0 for "All messages").
5.  **Filtering**: Use the **Quick Date Presets** ([Today], [7 Days], etc.) or the **Native Calendar Pickers** to select a time frame.
6.  **Exporting**: Choose your format (JSON, CSV, or HTML) from the dropdown and click the **Export** button.
6.  **Make Sure**: You have a **Channel** or **DM** selected Before entering **Settings**

### 🆔 How to get a Discord User ID
To use the **User ID** filter, you need the unique numerical ID of the user:
1.  Go to **Discord Settings** > **Advanced**.
2.  Enable **Developer Mode**.
3.  **Right-click** any user's name or avatar anywhere in Discord.
4.  Select **Copy User ID** at the bottom of the menu.

## ⚙️ Configuration

- **Export Path**: The directory where your chat exports will be stored. Each export gets its own unique subfolder.
- **Message Limit**: Controls the depth of the export. Useful for quickly grabbing recent history without fetching years of data.
- **Download Media**: If enabled, all images, videos, and files in the chat will be saved to your computer.
- **Date/User Filters**: Allows you to export specific time periods or messages from a single user.

## 📝 License

This project is licensed under the GPL-3.0 License - see the LICENSE file for details.

---

*Made with ❤️ for the Vencord community.*
