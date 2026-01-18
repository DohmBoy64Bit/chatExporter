/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { dialog } from "electron";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";

export async function selectFolder() {
    const result = await dialog.showOpenDialog({
        properties: ["openDirectory"]
    });
    if (result.canceled) return null;
    return result.filePaths[0];
}

export async function saveFile(_: any, folderPath: string, fileName: string, content: string) {
    try {
        await mkdir(folderPath, { recursive: true });
        const filePath = join(folderPath, fileName);
        await writeFile(filePath, content, "utf-8");
        return { ok: true };
    } catch (error) {
        return { ok: false, error: String(error) };
    }
}
