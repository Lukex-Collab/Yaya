export function setToken(token: string): void {
  wx.setStorageSync('token', token);
}

export function getToken(): string {
  return wx.getStorageSync('token') || '';
}

export function clearToken(): void {
  wx.removeStorageSync('token');
}

export function isLoggedIn(): boolean {
  return !!getToken();
}
