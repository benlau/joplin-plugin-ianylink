import joplin from 'api';
import { MenuItemLocation, SettingItemType } from 'api/types';
import * as copy from 'copy-to-clipboard';
import { UniversalLink } from './links/universallink';

const SETTING_SECTION = "ianylink.settings";
const LINK_CONVERTOR_URL = "https://benlau.github.io/l"

enum Feature {
	CopyWebLinkEnabled = "ianylink.copy_web_link",
	CopyMarkdownWebLinkEnabled = "ianylink.copy_markdown_web_link",
	CopyWebLinkWithTitleEnabled = "ianylink.copy_web_link_with_title",
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

function createWebLink(noteId: string) {
    const link = createOpenNoteCallbackLink(noteId);

    const path =  new UniversalLink().encode(link);
    return `${LINK_CONVERTOR_URL}${path}`
}

async function createMarkdownWebLink(noteId: string) {
    const title = await getTitle(noteId);
    const webLink = createWebLink(noteId);

    return `[${title}](${webLink})`;
}

async function createWebLinkWithTitle(noteId: string) {
    const title = await getTitle(noteId);
    const webLink = createWebLink(noteId);

    return `${title}
${webLink}`
}

function openLinkConvertorUrl() {
    window.open(LINK_CONVERTOR_URL);
}

function copyLink(func) {
    return async () => {
        const ids = await joplin.workspace.selectedNoteIds();
        if (ids.length === 0) return;
        const notebookId = ids[0];
        copy(await func(notebookId));
    }
}

const config = {
    [Feature.CopyWebLinkEnabled]: {
        setting: "Enable - copy web link",
        menu: "Copy web link",
        cmd: copyLink(createWebLink)
    },
    [Feature.CopyMarkdownWebLinkEnabled]: {
        setting: "Enable - copy markdown web link",
        menu: "Copy markdown web link",
        cmd: copyLink(createMarkdownWebLink),
    },
    [Feature.CopyWebLinkWithTitleEnabled]: {
        setting: "Enable - copy web link with title",
        menu: "Copy web link with title",
        cmd: copyLink(createWebLinkWithTitle)
    },
    [Feature.OpenLinkConvertor] : {
        setting: "Enable - open link convertor",
        menu: "Open link convertor",
        cmd: openLinkConvertorUrl
    }
}

joplin.plugins.register({
    onStart: async function() {
        // eslint-disable-next-line no-console
        console.log("Start ianylink plugin");

        await Promise.all(Object.values(Feature).map( async key => {
            await joplin.commands.register({
                name: getCommandName(key),
                label: config[key as string].menu,
                execute: config[key as string].cmd
            });
        }));

        await joplin.settings.registerSection(SETTING_SECTION, {
            label: "IAnylink",
            iconName: "fas fa-link",
            name: "Copy Web Link",
            description: "Copy web link Settings\nRestart is required to take effect"
        });

        await joplin.settings.registerSettings(
            Object.fromEntries(
                Object.values(Feature).map( (key) => {
                    const value = key === Feature.CopyWebLinkEnabled;
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
        );

        await Promise.all(Object.values(Feature).map(async key => {
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
        console.log("End of ianylink initialization")
    },
});
