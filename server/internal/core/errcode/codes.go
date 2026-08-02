package errcode

// 错误码规范 (5位)
// 格式: <模块2位><错误3位>
// 模块: 00=通用 01=认证 02=用户 03=对话 04=记忆 05=日记 06=仪式 07=健康 08=成就 09=安全 10=支付 11=订阅

const (
	// 通用错误 00xxx
	Success          = 0
	ErrInternal      = 1
	ErrBadRequest    = 2
	ErrNotFound      = 3
	ErrRateLimit     = 4
	ErrMaintenance   = 5
	ErrDBDown        = 6

	// 认证模块 01xxx
	ErrAuthMissing   = 10100
	ErrAuthInvalid   = 10101
	ErrAuthExpired   = 10102
	ErrWeChatCode    = 10103

	// 用户模块 02xxx
	ErrUserNotFound  = 20200
	ErrUserBanned    = 20201
	ErrUserExists    = 20202

	// 对话模块 03xxx
	ErrChatEmpty     = 30300
	ErrChatTooLong   = 30301
	ErrChatRateLimit = 30302
	ErrChatQuotaExceeded = 30303 // 免费额度用完
	ErrChatAIError   = 30304

	// 记忆模块 04xxx
	ErrMemoryNotFound = 40400
	ErrMemoryIngestFailed = 40401
	ErrMemorySearchFailed = 40402

	// 日记模块 05xxx
	ErrJournalNotFound = 50500
	ErrJournalTooLong  = 50501

	// 支付模块 10xxx
	ErrPayNotConfigured = 100000
	ErrPayOrderCreate   = 100001
	ErrPayOrderNotFound  = 100002
	ErrPayRefundFailed   = 100003

	// 订阅模块 11xxx
	ErrSubNotFound      = 110000
	ErrSubExpired       = 110001
	ErrSubAlreadyActive = 110002
)

var messages = map[int]string{
	Success:            "ok",
	ErrInternal:        "服务器内部错误",
	ErrBadRequest:      "请求参数有误",
	ErrNotFound:        "资源不存在",
	ErrRateLimit:       "请求过于频繁，请稍后再试",
	ErrMaintenance:     "系统维护中",
	ErrDBDown:          "数据库连接异常",

	ErrAuthMissing:     "缺少认证信息",
	ErrAuthInvalid:     "认证信息无效",
	ErrAuthExpired:     "认证已过期",
	ErrWeChatCode:      "微信登录失败",

	ErrUserNotFound:    "用户不存在",
	ErrUserBanned:      "账号已被禁用",
	ErrUserExists:      "用户已存在",

	ErrChatEmpty:       "消息不能为空",
	ErrChatTooLong:     "消息超过字数限制",
	ErrChatRateLimit:   "说话太快啦，休息一下",
	ErrChatQuotaExceeded: "今日免费额度已用完，订阅后可无限畅聊",
	ErrChatAIError:     "牙牙走神了，请稍后重试",

	ErrMemoryNotFound:  "记忆不存在",
	ErrMemoryIngestFailed: "记忆存储失败",
	ErrMemorySearchFailed: "记忆检索失败",

	ErrJournalNotFound: "日记不存在",
	ErrJournalTooLong:  "日记超过字数限制",

	ErrPayNotConfigured: "支付未配置",
	ErrPayOrderCreate:   "创建订单失败",
	ErrPayOrderNotFound:  "订单不存在",
	ErrPayRefundFailed:   "退款失败",

	ErrSubNotFound:      "未找到订阅记录",
	ErrSubExpired:       "订阅已过期",
	ErrSubAlreadyActive: "订阅仍在有效期内",
}

func Message(code int) string {
	if msg, ok := messages[code]; ok {
		return msg
	}
	return "未知错误"
}
