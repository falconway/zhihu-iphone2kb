import { test, mock, beforeEach } from "node:test"
import assert from "node:assert/strict"

// Replace file-saver with a spy before any test imports iosSave.ts.
const saveAsSpy = mock.fn()
mock.module("file-saver", {
    namedExports: { saveAs: saveAsSpy },
})

const { iosAwareSave, iosAwareSaveDataUrl } = await import(
    "../src/core/iosSave.ts"
)

const IPHONE_UA =
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
const IPAD_AS_MAC_UA =
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15"
const DESKTOP_CHROME_UA =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36"

function setNavigator({ ua, platform = "", maxTouchPoints = 0, canShare, share } = {}) {
    const nav = { userAgent: ua, platform, maxTouchPoints }
    if (canShare) nav.canShare = canShare
    if (share) nav.share = share
    Object.defineProperty(globalThis, "navigator", {
        value: nav,
        configurable: true,
        writable: true,
    })
}

let openedUrls = []
function setWindow() {
    globalThis.window = { open: (url) => openedUrls.push(url) }
}

beforeEach(() => {
    saveAsSpy.mock.resetCalls()
    openedUrls = []
    if (!globalThis.URL.createObjectURL) {
        globalThis.URL.createObjectURL = () => "blob:fake-url"
        globalThis.URL.revokeObjectURL = () => {}
    }
    setWindow()
})

test("iPhone UA + canShare(true) → calls navigator.share with a File", async () => {
    let shared = null
    setNavigator({
        ua: IPHONE_UA,
        canShare: ({ files }) => Array.isArray(files) && files.length > 0,
        share: async (data) => {
            shared = data
        },
    })

    const blob = new Blob(["hello"], { type: "text/markdown" })
    await iosAwareSave(blob, "post.md", "text/markdown")

    assert.ok(shared, "navigator.share was not called")
    assert.equal(shared.title, "post.md")
    assert.equal(shared.files.length, 1)
    assert.equal(shared.files[0].name, "post.md")
    assert.equal(shared.files[0].type, "text/markdown")
    assert.equal(saveAsSpy.mock.callCount(), 0, "saveAs should not be called on iOS")
    assert.equal(openedUrls.length, 0, "window.open should not be called on iOS share success")
})

test("iPadOS-as-Mac (MacIntel + maxTouchPoints>1) is detected as iOS", async () => {
    let shared = null
    setNavigator({
        ua: IPAD_AS_MAC_UA,
        platform: "MacIntel",
        maxTouchPoints: 5,
        canShare: () => true,
        share: async (d) => {
            shared = d
        },
    })

    await iosAwareSave(new Blob(["x"]), "y.zip", "application/zip")

    assert.ok(shared, "iPadOS should go through share path")
    assert.equal(saveAsSpy.mock.callCount(), 0)
})

test("MacIntel without touch (real desktop Mac) is NOT iOS → falls through to saveAs", async () => {
    setNavigator({
        ua: IPAD_AS_MAC_UA,
        platform: "MacIntel",
        maxTouchPoints: 0,
    })

    await iosAwareSave(new Blob(["x"]), "y.zip", "application/zip")

    assert.equal(saveAsSpy.mock.callCount(), 1)
    assert.equal(saveAsSpy.mock.calls[0].arguments[1], "y.zip")
})

test("iPhone UA + canShare(false) → falls back to window.open(blobUrl)", async () => {
    setNavigator({
        ua: IPHONE_UA,
        canShare: () => false,
        share: async () => assert.fail("share must not be called when canShare is false"),
    })

    await iosAwareSave(new Blob(["x"]), "fallback.md", "text/plain")

    assert.equal(openedUrls.length, 1)
    assert.match(openedUrls[0], /^blob:/)
    assert.equal(saveAsSpy.mock.callCount(), 0)
})

test("iPhone UA + share() throws → falls back to window.open(blobUrl)", async () => {
    setNavigator({
        ua: IPHONE_UA,
        canShare: () => true,
        share: async () => {
            throw new Error("user cancelled")
        },
    })

    await iosAwareSave(new Blob(["x"]), "thrown.md", "text/plain")

    assert.equal(openedUrls.length, 1)
    assert.match(openedUrls[0], /^blob:/)
    assert.equal(saveAsSpy.mock.callCount(), 0, "iOS share failure should not fall through to desktop saveAs")
})

test("Desktop UA → calls saveAs and never touches share / window.open", async () => {
    let shareCalled = false
    setNavigator({
        ua: DESKTOP_CHROME_UA,
        canShare: () => true,
        share: async () => {
            shareCalled = true
        },
    })

    const blob = new Blob(["x"], { type: "application/zip" })
    await iosAwareSave(blob, "desktop.zip", "application/zip")

    assert.equal(saveAsSpy.mock.callCount(), 1)
    assert.equal(saveAsSpy.mock.calls[0].arguments[1], "desktop.zip")
    assert.equal(shareCalled, false)
    assert.equal(openedUrls.length, 0)
})

test("iosAwareSaveDataUrl on iOS: fetches dataUrl → blob → goes through share", async () => {
    let shared = null
    setNavigator({
        ua: IPHONE_UA,
        canShare: () => true,
        share: async (d) => {
            shared = d
        },
    })

    const tinyPngDataUrl =
        "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="

    await iosAwareSaveDataUrl(tinyPngDataUrl, "shot.png", "image/png")

    assert.ok(shared)
    assert.equal(shared.files.length, 1)
    assert.equal(shared.files[0].name, "shot.png")
    assert.equal(shared.files[0].type, "image/png")
    assert.ok(shared.files[0].size > 0, "PNG file should have non-zero size after dataUrl fetch")
})

test("iosAwareSaveDataUrl on desktop: creates <a download> and clicks (no share)", async () => {
    setNavigator({ ua: DESKTOP_CHROME_UA })

    let createdAnchor = null
    let clicked = false
    globalThis.document = {
        createElement: (tag) => {
            assert.equal(tag, "a")
            createdAnchor = {
                tagName: "A",
                click() {
                    clicked = true
                },
            }
            return createdAnchor
        },
    }

    const tinyPngDataUrl =
        "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="

    await iosAwareSaveDataUrl(tinyPngDataUrl, "desk.png", "image/png")

    assert.ok(createdAnchor, "should have created an anchor")
    assert.equal(createdAnchor.download, "desk.png")
    assert.equal(createdAnchor.href, tinyPngDataUrl)
    assert.equal(clicked, true)
})
