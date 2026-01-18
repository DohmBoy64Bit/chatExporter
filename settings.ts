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
        type: OptionType.NUMBER,
        default: 0
    },
    downloadMedia: {
        description: "Download all attachments locally.",
        type: OptionType.BOOLEAN,
        default: false
    },
    filterStartDate: {
        description: "Export starting from (YYYY-MM-DD).",
        type: OptionType.STRING,
        default: "",
        hidden: true
    },
    filterEndDate: {
        description: "Export up to (YYYY-MM-DD).",
        type: OptionType.STRING,
        default: "",
        hidden: true
    },
    filterUserId: {
        description: "Only export messages from this User ID.",
        type: OptionType.STRING,
        default: "",
        hidden: true
    }
});
