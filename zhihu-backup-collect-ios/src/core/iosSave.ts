import { saveAs } from "file-saver"

const isIOS = (): boolean => {
    const ua = navigator.userAgent || ""
    if (/iPad|iPhone|iPod/.test(ua)) return true
    return navigator.platform === "MacIntel" && (navigator as any).maxTouchPoints > 1
}

function openBlobUrl(blob: Blob): void {
    const url = URL.createObjectURL(blob)
    console.info("[ZhihuBackup][iOSSave] Open blob URL fallback")
    window.open(url, "_blank")
    setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

export async function iosAwareSave(blob: Blob, filename: string, mime?: string): Promise<void> {
    if (isIOS()) {
        const nav: any = navigator
        try {
            const file = new File([blob], filename, { type: mime || blob.type || "application/octet-stream" })
            if (nav.canShare && nav.canShare({ files: [file] })) {
                console.info("[ZhihuBackup][iOSSave] navigator.share:", filename, file.type, file.size)
                await nav.share({ files: [file], title: filename })
                return
            }
            console.warn("[ZhihuBackup][iOSSave] navigator.canShare returned false, using blob fallback:", filename)
            openBlobUrl(blob)
            return
        } catch (e) {
            console.warn("iosAwareSave share failed, falling back to blob URL", e)
            openBlobUrl(blob)
            return
        }
    }
    saveAs(blob, filename)
}

export async function iosAwareSaveDataUrl(dataUrl: string, filename: string, mime: string): Promise<void> {
    if (isIOS()) {
        const blob = await (await fetch(dataUrl)).blob()
        await iosAwareSave(blob, filename, mime)
        return
    }
    const link = document.createElement("a")
    link.download = filename
    link.href = dataUrl
    link.click()
}
