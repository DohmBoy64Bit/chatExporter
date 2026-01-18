import { definePluginSettings } from "@api/Settings";
import { OptionType } from "@utils/types";

export const settings = definePluginSettings({
    exportPath: {
        description: "Custom folder to save exports to.",
        type: OptionType.STRING,
        default: "",
        hidden: true
    },
    messageLimit: {
        description: "Maximum number of messages to export (0 = all messages).",
        type: OptionType.SLIDER,
        default: 0,
        markers: [0, 1000, 5000, 10000],
        stickToMarkers: false
    }
});
