import fs from "fs"

const packageInfo = JSON.parse(fs.readFileSync("./package.json", "utf-8").toString())

export const UserScriptContent = fs.readFileSync("./dist/bundle.min.js", "utf-8").toString().trim()
//.replace(/\/\*[\s\S]*?\*\/|([^\\:]|^)\/\/.*$/gm, "")会误伤base64

export const UserScript = {
    "name": "知乎备份剪藏 (iOS)",
    "namespace": "qtqz-ios",
    "source": "https://github.com/falconway/zhihu-iphone2kb",
    "version": packageInfo.version,
    "description": "iOS-adapted: 将你喜欢的知乎回答/文章/想法保存为 markdown / zip / png（通过分享单到「文件」）",
    "updateURL": "https://raw.githubusercontent.com/falconway/zhihu-iphone2kb/main/zhihu-backup-collect-ios/dist/tampermonkey-script.user.js",
    "downloadURL": "https://raw.githubusercontent.com/falconway/zhihu-iphone2kb/main/zhihu-backup-collect-ios/dist/tampermonkey-script.user.js",
    "supportURL": "https://github.com/falconway/zhihu-iphone2kb/issues",
    "author": packageInfo.author,
    "match": [
        "https:\/\/www.zhihu.com/follow",
        "https:\/\/www.zhihu.com/pin/*",
        "https:\/\/www.zhihu.com/people/*",
        "https:\/\/www.zhihu.com/org/*",
        "https:\/\/www.zhihu.com/question/*",
        "https:\/\/www.zhihu.com/answer/*",
        "https:\/\/www.zhihu.com/collection/*",
        "https:\/\/zhuanlan.zhihu.com/p/*",
        "https:\/\/www.zhihu.com/search*content*",
        "https:\/\/www.zhihu.com/"
    ],
    "license": packageInfo.license,
    "icon": "https://static.zhihu.com/heifetz/favicon.ico",
    "grant": [
        "GM_setValue",
        "GM_getValue",
        "GM_registerMenuCommand",
        "GM_unregisterMenuCommand"
    ]
}