import joplin from 'api';
import { MenuItem, MenuItemLocation, SettingItemType } from 'api/types';
import * as copy from 'copy-to-clipboard';
import { JoplinLink } from './links/joplinlink';

const SETTING_SECTION = "ianylink.settings";
const LINK_CONVERTOR_URL = "https://benlau.github.io/l"

enum Feature {
	CopyUniversalWebLink = "ianylink.copy_universal_web_link",
	CopyUniversalMarkdownWebLink = "ianylink.copy_universal_markdown_web_link",
	CopyUniversalWebLinkWithTitle = "ianylink.copy_universal_web_link_with_title",
	OpenLinkConvertor = "ianylink.open_link_convertor"
}

function getSettingKey(feature: string) {
    return `${feature}_enabled`;
}

function getCommandName(feature: string) {
    return `${feature}_command`;
}

function getMenuKey(feature: string) {
    return `${feature}_menu`;
}

async function getTitle(noteId: string) {
    const { title } = await joplin.data.get(["notes", noteId], ["title"]);
    return title;
}

function createOpenNoteCallbackLink(noteId: string) {
    return `joplin://x-callback-url/openNote?id=${noteId}`
}

function createWebLink(noteId: string, serviceUrl: string) {
    const link = createOpenNoteCallbackLink(noteId);

    const path =  new JoplinLink().encodeLink(link);
    return `${serviceUrl}${path}`
}

async function createMarkdownWebLink(noteId: string, serviceUrl: string) {
    const title = await getTitle(noteId);
    const webLink = createWebLink(noteId, serviceUrl);

    return `[${title}](${webLink})`;
}

async function createWebLinkWithTitle(noteId: string, serviceUrl: string) {
    const title = await getTitle(noteId);
    const webLink = createWebLink(noteId, serviceUrl);

    return `${title}
${webLink}`
}

async function openLinkConvertorUrl() {
    const serviceUrl = await joplin.settings.value(
        "ianylink.service_url"
    );
    window.open(serviceUrl);
}

function copyLink(func) {
    return async () => {
        const ids = await joplin.workspace.selectedNoteIds();
        const serviceUrl = await joplin.settings.value(
            "ianylink.service_url"
        );
        if (ids.length === 0) return;
        const notebookId = ids[0];
        copy(await func(notebookId, serviceUrl));
    }
}

const config = {
    [Feature.CopyUniversalWebLink]: {
        setting: "Enable - copy universal web link",
        menu: "Copy universal web link",
        cmd: copyLink(createWebLink)
    },
    [Feature.CopyUniversalMarkdownWebLink]: {
        setting: "Enable - copy markdown universal web link",
        menu: "Copy universal markdown web link",
        cmd: copyLink(createMarkdownWebLink),
    },
    [Feature.CopyUniversalWebLinkWithTitle]: {
        setting: "Enable - copy title and universal web link",
        menu: "Copy title and universal web link",
        cmd: copyLink(createWebLinkWithTitle)
    },
    [Feature.OpenLinkConvertor] : {
        setting: "Enable - open link convertor",
        menu: "Open link convertor",
        cmd: openLinkConvertorUrl
    }
}

const NOTE_LIST_CONTEXT_MENU_ITEMS = [
    Feature.CopyUniversalWebLink,
    Feature.CopyUniversalMarkdownWebLink,
    Feature.CopyUniversalWebLinkWithTitle,
]

joplin.plugins.register({
    onStart: async function() {
        await Promise.all(Object.values(Feature).map( async key => {
            await joplin.commands.register({
                name: getCommandName(key),
                label: config[key as string].menu,
                execute: config[key as string].cmd
            });
        }));

        await joplin.settings.registerSection(SETTING_SECTION, {
            label: "Copy Universal Web Link",
            iconName: "fas fa-link",
            name: "Copy Universal Web Link",
            description: "Copy Universal Web Link Settings (Restart is required for changes to take effect)"
        });

        const settings = {
            "ianylink.service_url": {
                type: SettingItemType.String,
                public: true,
                label: "iAnyLink Service URL",
                section: SETTING_SECTION,
                value: LINK_CONVERTOR_URL,
                description: "The URL of the iAnyLink service. You may change it to your own service URL."
            },
            ...Object.fromEntries(
                Object.values(Feature).map(key => {
                    const value = key === Feature.CopyUniversalWebLink;
                    const setting = getSettingKey(key as Feature);
                    return [setting, {
                        value,
                        type: SettingItemType.Bool,
                        public: true,
                        label: config[key].setting,
                        section: SETTING_SECTION
                    }]
                })
            )
        };

        await joplin.settings.registerSettings(
            settings
        );

        // Create note list context menu
        await Promise.all(NOTE_LIST_CONTEXT_MENU_ITEMS.map(async key => {
            const commandName = getCommandName(key);
            const enabled = await joplin.settings.value(
                getSettingKey(key)
            );
            if (enabled !== true) {
                return;
            }

            await joplin.views.menuItems.create(
                getMenuKey(key),
                commandName,
                MenuItemLocation.NoteListContextMenu
            );
        }));

        const toolMenuItems = Object.values(Feature).map(key => {
            const commandName = getCommandName(key);
            return {
                commandName
            }
        }) as MenuItem[];

        await joplin.views.menus.create("ianylink.tool_menu", 
            "Open Univeral Web Link" , toolMenuItems, MenuItemLocation.Tools);
    },
});
