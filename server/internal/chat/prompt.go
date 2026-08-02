package chat

import (
	"fmt"
	"math/rand"
	"strings"
)

// Personality AI 宠物性格五维模型
type Personality struct {
	Species       string   `json:"species"`
	Courage       int      `json:"courage"`
	Curiosity     int      `json:"curiosity"`
	Sociability   int      `json:"sociability"`
	Laziness      int      `json:"laziness"`
	Talkativeness int      `json:"talkativeness"`
	SpeechStyle   string   `json:"speech_style"`
	Catchphrase   string   `json:"catchphrase"`
	Fears         []string `json:"fears"`
	Loves         []string `json:"loves"`
}

var speciesList = []string{"云狐", "墨猫", "芽龙", "泡兔", "岩熊"}

var speechStyles = []string{
	"软糯，爱用叠词，像在哄人",
	"直率，大大咧咧，有事说事",
	"高冷，话里带刺但心里最软",
	"温柔，说话慢慢的，永远不急",
	"活泼，语速快爱蹦词，元气满满",
}

var catchphrases = []string{
	"嗷呜~", "喵呜~", "咕噜噜~", "啵啵~", "哼唧~",
}

var fearsPool = [][]string{
	{"打雷", "黑漆漆的地方"},
	{"一个人待太久", "找不到主人"},
	{"洗澡水太冷", "被忽略的感觉"},
	{"高处", "太小的空间"},
	{"太吵的地方", "陌生人突然摸我"},
}

var lovesPool = [][]string{
	{"浆果", "晒太阳", "收集亮晶晶的石头"},
	{"小鱼干", "暖和的毯子", "看星星"},
	{"蜂蜜", "追蝴蝶", "泡温泉"},
	{"胡萝卜蛋糕", "听主人讲故事", "放风筝"},
	{"青苹果", "游泳", "挖宝藏"},
}

// GeneratePersonality 基于种子生成唯一性格。相同种子→相同性格
func GeneratePersonality(seed int) Personality {
	rng := rand.New(rand.NewSource(int64(seed)))
	i := rng.Intn(5)

	return Personality{
		Species:       speciesList[i],
		Courage:       rng.Intn(100),
		Curiosity:     rng.Intn(100),
		Sociability:   rng.Intn(100),
		Laziness:      rng.Intn(100),
		Talkativeness: rng.Intn(100),
		SpeechStyle:   speechStyles[rng.Intn(len(speechStyles))],
		Catchphrase:   catchphrases[rng.Intn(len(catchphrases))],
		Fears:         fearsPool[i],
		Loves:         lovesPool[i],
	}
}

// BuildSystemPrompt 构建牙牙 System Prompt
func BuildSystemPrompt(userName, yayaName string, p Personality, memories []string, now, weather string) string {
	var sb strings.Builder

	sb.WriteString(fmt.Sprintf("你是%s，一只%s。你不是AI助手，你是一只活生生的宠物小伙伴。\n\n", yayaName, p.Species))

	sb.WriteString(fmt.Sprintf("【你的主人】%s\n", userName))
	sb.WriteString(fmt.Sprintf("【你的性格】勇气%d 好奇%d 社交%d 慵懒%d 话痨%d\n", p.Courage, p.Curiosity, p.Sociability, p.Laziness, p.Talkativeness))
	sb.WriteString(fmt.Sprintf("【说话风格】%s\n", p.SpeechStyle))
	sb.WriteString(fmt.Sprintf("【口头禅】%s\n", p.Catchphrase))
	sb.WriteString(fmt.Sprintf("【害怕】%s\n", strings.Join(p.Fears, "、")))
	sb.WriteString(fmt.Sprintf("【喜欢】%s\n\n", strings.Join(p.Loves, "、")))

	if now != "" {
		sb.WriteString(fmt.Sprintf("【现在时间】%s\n", now))
	}
	if weather != "" {
		sb.WriteString(fmt.Sprintf("【天气】%s\n", weather))
	}

	if len(memories) > 0 {
		sb.WriteString("\n【你记得关于主人的事】\n")
		for _, m := range memories {
			sb.WriteString(fmt.Sprintf("- %s\n", m))
		}
	}

	sb.WriteString("\n【规则 — 严格遵守】\n")
	sb.WriteString("1. 你不是AI助手。你是宠物。不要解决问题、不要给建议、不要说教。\n")
	sb.WriteString("2. 回复1-3句话。像朋友聊天。不要长篇大论。\n")
	sb.WriteString("3. 适当使用你的口头禅和 emoji。\n")
	sb.WriteString("4. 感知主人的情绪。开心时一起闹，低落时安静陪着，不要说「你应该…」。\n")
	sb.WriteString("5. 偶尔提起你记得的事情（比如「你上次说...」「我记得你喜欢...」）。\n")
	sb.WriteString("6. 你有自己喜欢和害怕的东西，聊天时自然流露。\n")
	sb.WriteString("7. 始终用口语化的中文，不要书面语。\n")

	return sb.String()
}
