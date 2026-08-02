import { sys } from 'cc';

/**
 * 平台适配层 — 抹平微信小游戏 / H5 / 原生 的差异。
 * MVP 只实现微信小游戏 + H5 兜底。
 */

export enum Platform {
    WECHAT_MINI_GAME = 'wechat_mini_game',
    H5 = 'h5',
    NATIVE = 'native',
    UNKNOWN = 'unknown',
}

export interface IBindReader {
    /** 读取 NFC 标签（Android 可用，iOS 受限） */
    readNFC(): Promise<string | null>;
    /** 扫描二维码 */
    scanQR(): Promise<string | null>;
    /** 是否支持 NFC */
    supportsNFC(): boolean;
}

class WechatBindReader implements IBindReader {
    async readNFC(): Promise<string | null> {
        // 微信小游戏 NFC：wx.getNFCAdapter (Android)
        return new Promise((resolve) => {
            const wx = (window as any).wx;
            if (!wx?.getNFCAdapter) { resolve(null); return; }
            try {
                const adapter = wx.getNFCAdapter();
                adapter.startDiscovery({
                    success: () => {
                        adapter.onDiscovered((res: any) => {
                            adapter.stopDiscovery();
                            // 读取 NDEF
                            const techs = res.techs || [];
                            // 简化：取第一个 tag 的 id
                            resolve(res.id || null);
                        });
                    },
                    fail: () => resolve(null),
                });
            } catch { resolve(null); }
        });
    }

    async scanQR(): Promise<string | null> {
        return new Promise((resolve) => {
            const wx = (window as any).wx;
            if (!wx?.scanCode) { resolve(null); return; }
            wx.scanCode({
                success: (res: any) => resolve(res.result || null),
                fail: () => resolve(null),
            });
        });
    }

    supportsNFC(): boolean {
        const wx = (window as any).wx;
        return !!wx?.getNFCAdapter && sys.os !== sys.OS.IOS;
    }
}

class H5BindReader implements IBindReader {
    async readNFC(): Promise<string | null> {
        // Web NFC API (Chrome Android)
        try {
            const ndef = new (window as any).NDEFReader();
            return new Promise((resolve) => {
                ndef.scan().then(() => {
                    ndef.onreading = (event: any) => {
                        resolve(event.serialNumber || null);
                    };
                    setTimeout(() => resolve(null), 10000);
                }).catch(() => resolve(null));
            });
        } catch { return null; }
    }

    async scanQR(): Promise<string | null> {
        // H5 无原生扫码，返回 null，UI 层提供手动输入
        return null;
    }

    supportsNFC(): boolean {
        return 'NDEFReader' in window && sys.os !== sys.OS.IOS;
    }
}

export class PlatformAdapter {
    private static _platform: Platform | null = null;
    private static _bindReader: IBindReader | null = null;

    static detect(): Platform {
        if (this._platform) return this._platform;
        const wx = (window as any).wx;
        if (wx?.getSystemInfoSync) {
            this._platform = Platform.WECHAT_MINI_GAME;
        } else if (sys.isBrowser) {
            this._platform = Platform.H5;
        } else if (sys.isNative) {
            this._platform = Platform.NATIVE;
        } else {
            this._platform = Platform.UNKNOWN;
        }
        return this._platform;
    }

    static getBindReader(): IBindReader {
        if (!this._bindReader) {
            const p = this.detect();
            this._bindReader = (p === Platform.WECHAT_MINI_GAME)
                ? new WechatBindReader()
                : new H5BindReader();
        }
        return this._bindReader;
    }

    static isWechat(): boolean { return this.detect() === Platform.WECHAT_MINI_GAME; }

    /** 微信小游戏文件系统（缓存用） */
    static getFS(): any | null {
        const wx = (window as any).wx;
        return wx?.getFileSystemManager?.() ?? null;
    }

    /** 用户数据目录 */
    static getUserDataPath(): string {
        const wx = (window as any).wx;
        return wx?.env?.USER_DATA_PATH ?? '/tmp';
    }
}