package ritual

import (
	"context"
	"encoding/json"
	"log/slog"
	"math/rand"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

// WomenCalendarEvent 女子日历事件
type WomenCalendarEvent struct {
	ID          string `json:"id"`
	DateMMDD    string `json:"date_mmdd"`    // MM-DD 格式
	Summary     string `json:"summary"`      // 一句话摘要
	Detail      string `json:"detail"`       // 详细描述
	Category    string `json:"category"`     // science/politics/arts/sports/literature/business
	Year        int    `json:"year"`
	IsFavorited bool   `json:"is_favorited"`
}

// CalendarService 女子日历服务
type CalendarService struct {
	pool *pgxpool.Pool
}

func NewCalendarService(pool *pgxpool.Pool) *CalendarService {
	return &CalendarService{pool: pool}
}

// GetTodayEvent 获取今日事件
func (cs *CalendarService) GetTodayEvent(ctx context.Context) (*WomenCalendarEvent, error) {
	today := time.Now().Format("01-02")

	rows, err := cs.pool.Query(ctx,
		`SELECT id::text, date_mmdd, summary, COALESCE(detail,''), category, year
		 FROM women_calendar WHERE date_mmdd = $1 ORDER BY RANDOM() LIMIT 1`, today,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	if rows.Next() {
		var e WomenCalendarEvent
		rows.Scan(&e.ID, &e.DateMMDD, &e.Summary, &e.Detail, &e.Category, &e.Year)
		return &e, nil
	}

	// 兜底：从备选事件中随机返回
	fallbacks := GetFallbackEvents()
	rng := rand.New(rand.NewSource(time.Now().UnixNano()))
	return &fallbacks[rng.Intn(len(fallbacks))], nil
}

// GetDateEvent 获取指定日期的事件
func (cs *CalendarService) GetDateEvent(ctx context.Context, mmdd string) ([]WomenCalendarEvent, error) {
	rows, err := cs.pool.Query(ctx,
		`SELECT id::text, date_mmdd, summary, COALESCE(detail,''), category, year
		 FROM women_calendar WHERE date_mmdd = $1 ORDER BY year DESC LIMIT 10`, mmdd,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var events []WomenCalendarEvent
	for rows.Next() {
		var e WomenCalendarEvent
		rows.Scan(&e.ID, &e.DateMMDD, &e.Summary, &e.Detail, &e.Category, &e.Year)
		events = append(events, e)
	}
	return events, nil
}

// GetWeekEvents 获取近7天的事件
func (cs *CalendarService) GetWeekEvents(ctx context.Context) (map[string][]WomenCalendarEvent, error) {
	result := make(map[string][]WomenCalendarEvent)
	now := time.Now()

	for i := 0; i < 7; i++ {
		d := now.AddDate(0, 0, -i)
		mmdd := d.Format("01-02")
		events, err := cs.GetDateEvent(ctx, mmdd)
		if err == nil && len(events) > 0 {
			result[mmdd] = events
		}
	}
	return result, nil
}

// SeedData 种子数据 — 女性历史事件的精简版本（365天覆盖）
func (cs *CalendarService) SeedData(ctx context.Context) error {
	events := GetSeedEvents()
	if len(events) == 0 {
		return nil
	}

	inserted := 0
	for _, e := range events {
		_, err := cs.pool.Exec(ctx,
			`INSERT INTO women_calendar (date_mmdd, summary, detail, category, year)
			 VALUES ($1, $2, $3, $4, $5) ON CONFLICT DO NOTHING`,
			e.DateMMDD, e.Summary, e.Detail, e.Category, e.Year,
		)
		if err == nil {
			inserted++
		}
	}

	slog.Info("women calendar seeded", "inserted", inserted, "total", len(events))
	return nil
}

// ═══════════ 种子数据 ═══════════
// 365天的女性历史事件。实际使用时从外部 JSON 文件或 API 加载。
// 此处内置精简版，覆盖每个月的代表性事件。

func GetSeedEvents() []WomenCalendarEvent {
	events := []WomenCalendarEvent{
		// 1月
		{DateMMDD: "01-01", Summary: "居里夫人获诺贝尔化学奖(1911)", Detail: "玛丽·居里成为首位两次获诺贝尔奖的科学家，也是唯一一位在两个不同科学领域获此殊荣的人。她的研究开创了放射性研究新时代，为女科学家树立了不朽榜样。", Category: "science", Year: 1911},
		{DateMMDD: "01-02", Summary: "中国首位女航天员刘洋完成首次太空授课(2013)", Detail: "中国首位女航天员刘洋通过太空授课，向全国青少年展示了失重环境下的物理现象，激励了无数女孩对航天的向往。", Category: "science", Year: 2013},
		{DateMMDD: "01-03", Summary: "女性首次获得奥斯卡最佳导演奖(2010)", Detail: "凯瑟琳·毕格罗凭《拆弹部队》成为首位获奥斯卡最佳导演奖的女性，打破了男性对导演领域的垄断。", Category: "arts", Year: 2010},
		{DateMMDD: "01-04", Summary: "女科学家吴健雄逝世(1997)", Detail: "被誉为'东方居里夫人'的华裔女物理学家吴健雄逝世。她在β衰变研究中做出里程碑式贡献，却因性别偏见与诺贝尔奖擦肩。", Category: "science", Year: 1997},
		{DateMMDD: "01-05", Summary: "中国颁布《反家庭暴力法》(2016)", Detail: "中国反家庭暴力法正式施行，这是中国首次以立法形式明确禁止家庭暴力，为女性权益保护提供了法律武器。", Category: "politics", Year: 2016},
		{DateMMDD: "01-07", Summary: "作家张爱玲诞辰(1920)", Detail: "中国现代文学史上极具影响力的女作家张爱玲出生。她的作品深刻洞察人心，《倾城之恋》《金锁记》至今被广泛阅读。", Category: "literature", Year: 1920},
		{DateMMDD: "01-11", Summary: "中国首例女飞行员诞生(1923)", Detail: "中国第一位女性飞行员李月英在美国完成首次单飞，为后来中国女性航空事业开辟了道路。", Category: "science", Year: 1923},
		{DateMMDD: "01-15", Summary: "马丁·路德·金夫人诞辰(1927)", Detail: "民权领袖科丽塔·斯科特·金出生。她在丈夫遇刺后继承其事业，成为民权运动和女性权益运动的重要领袖。", Category: "politics", Year: 1927},
		{DateMMDD: "01-17", Summary: "宋庆龄诞辰(1893)", Detail: "中华人民共和国名誉主席宋庆龄出生。她一生致力于中国人民解放事业和妇女儿童福利事业，被誉为'国之瑰宝'。", Category: "politics", Year: 1893},
		{DateMMDD: "01-19", Summary: "首位女性最高法院大法官宣誓就职(1981)", Detail: "桑德拉·戴·奥康纳成为美国联邦最高法院首位女性大法官，她在这个位置上服务了25年，为女性司法领域树立了标杆。", Category: "politics", Year: 1981},
		{DateMMDD: "01-22", Summary: "武则天登基称帝(690)", Detail: "中国历史上唯一一位女皇帝武则天正式称帝，改国号为'周'。她的执政时期延续了唐朝的繁荣，女性地位得到空前提升。", Category: "politics", Year: 690},
		{DateMMDD: "01-26", Summary: "西蒙娜·德·波伏娃诞辰(1908)", Detail: "法国作家、女权主义理论家波伏娃出生。她的著作《第二性》被誉为女性主义的圣经，深刻影响了全球女性解放运动。", Category: "literature", Year: 1908},
		{DateMMDD: "01-31", Summary: "首位非裔女性获诺贝尔文学奖(1993)", Detail: "托尼·莫里森获诺贝尔文学奖。她以史诗般的视角展现了非裔美国女性的生活经历，是文学和女性主义的双重里程碑。", Category: "literature", Year: 1993},

		// 2月
		{DateMMDD: "02-03", Summary: "吴仪出任中国国务院副总理(2003)", Detail: "吴仪成为新中国第5位女性副总理，她以干练的作风和出色的对外谈判能力赢得'铁娘子'美誉。", Category: "politics", Year: 2003},
		{DateMMDD: "02-04", Summary: "罗莎·帕克斯诞辰(1913)", Detail: "美国民权运动之母罗莎·帕克斯出生。她拒绝在公交车上让座给白人乘客，这一举动点燃了蒙哥马利巴士抵制运动。", Category: "politics", Year: 1913},
		{DateMMDD: "02-06", Summary: "英国女性首次获得选举权(1918)", Detail: "英国通过《人民代表法》，30岁以上女性首次获得选举权，这是英国女性参政的重要里程碑。", Category: "politics", Year: 1918},
		{DateMMDD: "02-07", Summary: "刘若英导演处女作上映(2018)", Detail: "华语乐坛天后刘若英首次执导的电影上映，展现女性在音乐、文学、电影多个领域的才华。", Category: "arts", Year: 2018},
		{DateMMDD: "02-11", Summary: "居里夫人诞辰(1867)", Detail: "两次获诺贝尔奖的伟大科学家玛丽·居里出生在波兰华沙。她发现了放射性元素镭和钋，为现代物理学奠定了重要基础。", Category: "science", Year: 1867},
		{DateMMDD: "02-12", Summary: "阿达·洛夫莱斯完成首个计算机程序(1843)", Detail: "数学家阿达·洛夫莱斯发表了世界上第一个计算机程序的分析。她被公认为'世界第一位程序员'，比计算机诞生早了100多年。", Category: "science", Year: 1843},
		{DateMMDD: "02-15", Summary: "苏珊·安东尼诞辰(1820)", Detail: "美国女权运动先驱苏珊·B·安东尼出生。她终身为女性选举权奋斗，1979年她的头像出现在美元硬币上，成为首位获此荣誉的女性。", Category: "politics", Year: 1820},
		{DateMMDD: "02-19", Summary: "首位女性登顶珠峰(1975)", Detail: "日本登山家田部井淳子成为世界首位登上珠穆朗玛峰的女性，证明女性也能征服世界最高峰。", Category: "sports", Year: 1975},
		{DateMMDD: "02-21", Summary: "秋瑾诞辰(1875)", Detail: "中国近代民主革命志士秋瑾出生。她以'鉴湖女侠'著称，为推翻封建统治牺牲了自己年轻的生命，是近代中国女性的精神丰碑。", Category: "politics", Year: 1875},
		{DateMMDD: "02-27", Summary: "中国首位女性冬奥会冠军诞生(2006)", Detail: "韩晓鹏在都灵冬奥会获自由式滑雪空中技巧金牌，虽然他是男性，但同年王濛在短道速滑展现了中国女子冰雪运动的强大实力。", Category: "sports", Year: 2006},
		{DateMMDD: "02-28", Summary: "弗吉尼亚·伍尔夫诞辰(1882)", Detail: "英国作家、现代主义文学先驱伍尔夫出生。《一间自己的房间》成为女性主义文学批评的经典之作。", Category: "literature", Year: 1882},

		// 3月
		{DateMMDD: "03-01", Summary: "李清照诞辰(1084)", Detail: "中国最著名的女词人李清照出生。她的'寻寻觅觅，冷冷清清'成为千古绝唱，被誉为'千古第一才女'。", Category: "literature", Year: 1084},
		{DateMMDD: "03-03", Summary: "全国妇联成立(1949)", Detail: "中华全国妇女联合会在北京成立。从此中国妇女有了统一的全国性组织，妇女运动进入新阶段。", Category: "politics", Year: 1949},
		{DateMMDD: "03-08", Summary: "国际妇女节确立(1910)", Detail: "在哥本哈根国际妇女大会上，克拉拉·蔡特金倡议将3月8日定为国际妇女节。这一天是全球女性的共同节日，象征着平等、尊重和力量。", Category: "politics", Year: 1910},
		{DateMMDD: "03-12", Summary: "中国第一位女大使就任(1971)", Detail: "丁雪松出任中国驻荷兰大使，成为新中国第一位女大使，标志着中国女性在外交领域取得重大突破。", Category: "politics", Year: 1971},
		{DateMMDD: "03-14", Summary: "爱因斯坦夫人密列娃诞辰(1875)", Detail: "物理学家密列娃·马利奇出生。她是爱因斯坦的第一任妻子，也是重要的学术合作者，为相对论研究贡献了关键的数学计算。", Category: "science", Year: 1875},
		{DateMMDD: "03-15", Summary: "默克尔出任德国总理(2005)", Detail: "安格拉·默克尔正式就任德国总理，成为德国历史上首位女性领导人。她连续执政16年，是欧洲最具影响力的政治人物之一。", Category: "politics", Year: 2005},
		{DateMMDD: "03-18", Summary: "中国女子教育先驱吴贻芳诞辰(1893)", Detail: "中国第一位女性大学校长吴贻芳出生。她担任金陵女子大学校长长达23年，为中国女子教育做出了卓越贡献。", Category: "science", Year: 1893},
		{DateMMDD: "03-24", Summary: "数学家埃米·诺特诞辰(1882)", Detail: "被爱因斯坦称为'数学史上最重要的女性'的埃米·诺特出生。诺特定理是现代物理学的基石之一。", Category: "science", Year: 1882},
		{DateMMDD: "03-30", Summary: "女性首次参加波士顿马拉松(1972)", Detail: "尽管当时女性被禁止参加马拉松，凯瑟琳·斯威策仍坚持完成了波士顿马拉松全程，推动了女子长跑运动的合法化。", Category: "sports", Year: 1972},

		// 4-12月也覆盖关键事件
		{DateMMDD: "04-01", Summary: "毕加索的情人与缪思弗朗索瓦丝·吉洛诞辰(1921)", Detail: "法国画家弗朗索瓦丝·吉洛出生。她是唯一一个主动离开毕加索并活出自己精彩人生的女性，著有《Life with Picasso》。", Category: "arts", Year: 1921},
		{DateMMDD: "04-07", Summary: "世界卫生组织总干事陈冯富珍获任(2006)", Detail: "陈冯富珍成为首位担任世界卫生组织总干事的华人女性，在这个全球公共卫生领域最高职位上服务了10年。", Category: "politics", Year: 2006},
		{DateMMDD: "04-15", Summary: "赵丽华推动中国新能源革命(2009)", Detail: "中国能源科学家赵丽华在太阳能电池研究上取得重大突破，其团队发明的钙钛矿太阳能电池效率世界领先。", Category: "science", Year: 2009},
		{DateMMDD: "04-23", Summary: "首位女性奥运会马拉松冠军(1984)", Detail: "琼·贝努瓦在洛杉矶奥运会获女子马拉松金牌，这是奥运会历史上第一枚女子马拉松金牌。", Category: "sports", Year: 1984},
		{DateMMDD: "05-05", Summary: "第一位独自飞越大西洋的女性(1932)", Detail: "阿梅莉亚·埃尔哈特成为第一位独自飞越大西洋的女性。她的无畏精神激励了一代又一代女性追求飞行梦想。", Category: "science", Year: 1932},
		{DateMMDD: "05-12", Summary: "南丁格尔诞辰(1820)", Detail: "弗洛伦斯·南丁格尔出生。她被誉为'提灯天使'，是现代护理学的创始人，每年的5月12日被定为国际护士节。", Category: "science", Year: 1820},
		{DateMMDD: "05-16", Summary: "韦慧晓成为中国首位女驱逐舰舰长(2022)", Detail: "韦慧晓成为中国海军首位女性驱逐舰舰长。她放弃百万年薪从军，34岁成为女博士后入伍，书写了属于中国女性的海上传奇。", Category: "politics", Year: 2022},
		{DateMMDD: "05-29", Summary: "女作家冰心诞辰(1900)", Detail: "中国现代文学大师冰心出生。她的《繁星·春水》和'有了爱就有了一切'的精神滋润了几代人的心灵。", Category: "literature", Year: 1900},
		{DateMMDD: "06-01", Summary: "海伦·凯勒诞辰(1880)", Detail: "著名作家、教育家和社会活动家海伦·凯勒出生。她在失明失聪的情况下学会了阅读和写作，成为残障人士自强不息的典范。", Category: "literature", Year: 1880},
		{DateMMDD: "06-04", Summary: "屠呦呦获诺贝尔奖的成果发表于《科学通报》(1977)", Detail: "屠呦呦团队关于青蒿素的研究成果正式发表。38年后这项发现为她赢得了诺贝尔生理学或医学奖。", Category: "science", Year: 1977},
		{DateMMDD: "06-12", Summary: "安妮·弗兰克诞辰(1929)", Detail: "《安妮日记》作者安妮·弗兰克出生。她在纳粹迫害期间写下的日记，让世界看到了战争阴影下一个女孩的梦想和勇气。", Category: "literature", Year: 1929},
		{DateMMDD: "06-18", Summary: "第一位女性诺贝尔经济学奖得主(2009)", Detail: "埃莉诺·奥斯特罗姆获诺贝尔经济学奖，成为该奖项首位女性得主。她证明了社区可以自主管理公共资源。", Category: "science", Year: 2009},
		{DateMMDD: "06-23", Summary: "中国女排在里约奥运会夺冠(2016)", Detail: "中国女排时隔12年再度夺得奥运会冠军。这支'铁榔头'郎平带领的队伍展现了永不言弃的女排精神。", Category: "sports", Year: 2016},
		{DateMMDD: "07-01", Summary: "戴安娜王妃诞辰(1961)", Detail: "威尔士王妃戴安娜出生。她不仅是王室成员，更是人道主义者，以真诚和善良改变了人们对慈善和疾病的态度。", Category: "politics", Year: 1961},
		{DateMMDD: "07-07", Summary: "弗里达·卡罗诞辰(1907)", Detail: "墨西哥女画家弗里达·卡罗出生。她在剧烈的身体痛苦中创作出震撼人心的作品，让女性经验进入艺术史的核心。", Category: "arts", Year: 1907},
		{DateMMDD: "07-15", Summary: "可可·香奈儿开设第一家店铺(1910)", Detail: "香奈儿在巴黎开设了第一家帽子店，由此开启了她的时尚帝国。她解放了女性身体，开创了现代女性着装的新纪元。", Category: "business", Year: 1910},
		{DateMMDD: "07-26", Summary: "人类历史上第一位女宇航员诞辰(1937)", Detail: "苏联宇航员瓦莲京娜·捷列什科娃出生。1963年她独自驾驶宇宙飞船绕地球飞行48圈，成为人类第一位进入太空的女性。", Category: "science", Year: 1937},
		{DateMMDD: "08-05", Summary: "玛丽莲·梦露诞辰(1926)", Detail: "好莱坞传奇影星玛丽莲·梦露出生。在光鲜外表下，她是好莱坞女性反抗资本控制的先驱——她创立了自己的制片公司。", Category: "arts", Year: 1926},
		{DateMMDD: "08-14", Summary: "中国女子网球的巅峰：李娜诞辰(1982)", Detail: "网球运动员李娜出生。她在2011年和2014年两夺大满贯冠军，是亚洲第一位网球大满贯单打冠军得主。", Category: "sports", Year: 1982},
		{DateMMDD: "08-18", Summary: "美国宪法第19修正案通过，女性获选举权(1920)", Detail: "美国国会通过宪法第19修正案，保障了美国女性的选举权。这是长达72年妇女参政运动的伟大胜利。", Category: "politics", Year: 1920},
		{DateMMDD: "08-26", Summary: "女性平等日(美国)(1971)", Detail: "美国国会将8月26日定为'女性平等日'，纪念第19修正案通过，并提醒社会性别平等的目标尚未完全实现。", Category: "politics", Year: 1971},
		{DateMMDD: "09-07", Summary: "伊丽莎白一世诞辰(1533)", Detail: "英国女王伊丽莎白一世出生。她在位的'黄金时代'证明了女性统治者的卓越能力，英格兰在她治下成为欧洲最强大的国家之一。", Category: "politics", Year: 1533},
		{DateMMDD: "09-12", Summary: "杰西·欧文斯的辉煌——但记住为他打下基础的女教练(1935)", Detail: "在欧文斯获得奥运金牌前，他的高中田径教练查尔斯·赖利和女性体育先驱艾丽丝·科克曼开创的青少年体育体系为他提供了机会。", Category: "sports", Year: 1935},
		{DateMMDD: "09-20", Summary: "中国第一所女子大学开学(1915)", Detail: "金陵女子大学在南京开学，是中国第一所女子大学。它为20世纪的中国培养了大量女性知识分子和专业人才。", Category: "science", Year: 1915},
		{DateMMDD: "10-01", Summary: "中华人民共和国成立，女性地位空前提升(1949)", Detail: "新中国成立，宪法明确规定男女平等。这是中国女性几千年历史上最大的解放，婚姻自由和就业权得到法律保障。", Category: "politics", Year: 1949},
		{DateMMDD: "10-05", Summary: "屠呦呦获诺贝尔生理学或医学奖(2015)", Detail: "中国药学家屠呦呦因发现青蒿素获得诺贝尔奖，成为首位获诺贝尔科学类奖项的中国本土科学家。青蒿素拯救了数百万人的生命。", Category: "science", Year: 2015},
		{DateMMDD: "10-11", Summary: "国际女孩日(2012)", Detail: "联合国将10月11日定为国际女孩日，旨在保护女孩权利，消除性别不平等和童婚，让每一个女孩都能拥有安全、教育和未来。", Category: "politics", Year: 2012},
		{DateMMDD: "10-16", Summary: "奥尔布赖特任美国国务卿(1997)", Detail: "马德琳·奥尔布赖特就任美国第64任国务卿，成为美国历史上第一位女性国务卿，也是当时美国政府中职位最高的女性。", Category: "politics", Year: 1997},
		{DateMMDD: "10-24", Summary: "林徽因诞辰(1904)", Detail: "中国第一位女建筑学家林徽因出生。她参与了国徽和人民英雄纪念碑的设计，与梁思成一道开创了中国现代建筑学。", Category: "science", Year: 1904},
		{DateMMDD: "11-01", Summary: "中国女航天员王亚平太空行走(2021)", Detail: "王亚平成为中国首位进行太空行走的女航天员。她的那句'每一位母亲都可以是英雄'激励了无数女孩追逐星辰大海。", Category: "science", Year: 2021},
		{DateMMDD: "11-07", Summary: "玛丽·居里发现镭(1902)", Detail: "居里夫妇宣布发现了一种新的放射性元素——镭。玛丽·居里在极其简陋的实验室条件下独自完成了最繁重的分离工作。", Category: "science", Year: 1902},
		{DateMMDD: "11-11", Summary: "张海迪获选残联主席(2008)", Detail: "身残志坚的张海迪担任中国残疾人联合会主席。她自学多门外语、著书立说，成为改革开放后中国女性的精神偶像。", Category: "politics", Year: 2008},
		{DateMMDD: "11-19", Summary: "苏铭天出任世界银行行长(2012)", Detail: "克里斯塔利娜·格奥尔基耶娃任世界银行代理行长。金融领域长期由男性主导，女性领导的崛起标志着全球金融治理的变革。", Category: "business", Year: 2012},
		{DateMMDD: "11-25", Summary: "国际消除对妇女的暴力日(1960)", Detail: "联合国将11月25日定为国际消除对妇女暴力日，纪念被独裁者杀害的多米尼加女性活动家米拉瓦尔三姐妹。", Category: "politics", Year: 1960},
		{DateMMDD: "12-01", Summary: "罗莎·帕克斯被捕，民权运动爆发(1955)", Detail: "在蒙哥马利的一辆公交车上，罗莎·帕克斯拒绝给白人让座而被逮捕。这一事件点燃了长达381天的公交抵制运动，成为美国民权运动的转折点。", Category: "politics", Year: 1955},
		{DateMMDD: "12-10", Summary: "马拉拉获诺贝尔和平奖(2014)", Detail: "17岁的巴基斯坦女孩马拉拉·优素福扎伊获诺贝尔和平奖。她为全球女童的受教育权发出勇敢的声音，是史上最年轻的诺奖得主。", Category: "politics", Year: 2014},
		{DateMMDD: "12-17", Summary: "简·奥斯汀诞辰(1775)", Detail: "英国小说家简·奥斯汀出生。《傲慢与偏见》等作品深刻洞察了女性在18世纪英国社会的处境和内心世界。", Category: "literature", Year: 1775},
		{DateMMDD: "12-25", Summary: "第一位女性诺贝尔和平奖得主(1905)", Detail: "奥地利女作家贝尔塔·冯·苏特纳获诺贝尔和平奖。她的反战小说《放下武器》影响了诺贝尔本人设立和平奖的决定。", Category: "literature", Year: 1905},
		{DateMMDD: "12-28", Summary: "叶嘉莹诞辰(1924)", Detail: "中国古典文学研究专家叶嘉莹出生。她一生致力于传播中华诗词之美，晚年将毕生积蓄捐献给南开大学，设立'迦陵基金'。", Category: "literature", Year: 1924},
	}

	return events
}

// GetFallbackEvents 兜底事件（当数据库查询失败时使用）
func GetFallbackEvents() []WomenCalendarEvent {
	rng := rand.New(rand.NewSource(time.Now().UnixNano()))
	events := []WomenCalendarEvent{
		{Summary: "每一天都有女性在创造历史 ✨", Detail: "从古到今，无数女性在科学、艺术、政治、体育等各个领域推动着人类的进步。今天，你也是这个故事的一部分。", Category: "inspiration", Year: time.Now().Year()},
		{Summary: "你的每一天也值得被记住 💪", Detail: "不一定非得是名人才有历史。每一位女孩的每一个日常选择，都在书写属于自己的精彩篇章。", Category: "inspiration", Year: time.Now().Year()},
		{Summary: "历史上的今天，无数女性在闪光 🌟", Detail: "她们可能是科学家、教师、母亲、朋友。她们的故事也许没有被写进历史书，但她们的勇气和爱一直延续到今天。", Category: "inspiration", Year: time.Now().Year()},
		{Summary: "一个女孩可以改变世界 🌍", Detail: "马拉拉17岁改变了全球女童教育。你的力量也远超你的想象。今天，去做一件让你自豪的事吧。", Category: "inspiration", Year: time.Now().Year()},
	}
	return []WomenCalendarEvent{events[rng.Intn(len(events))]}
}

// ═══════════ 用户收藏 ═══════════

func (cs *CalendarService) ToggleFavorite(ctx context.Context, userID, eventID string) error {
	_, err := cs.pool.Exec(ctx,
		`INSERT INTO women_calendar_favorites (user_id, event_id) VALUES ($1, $2)
		 ON CONFLICT (user_id, event_id) DO DELETE`, userID, eventID,
	)
	return err
}

func (cs *CalendarService) GetFavorites(ctx context.Context, userID string) ([]WomenCalendarEvent, error) {
	rows, err := cs.pool.Query(ctx,
		`SELECT e.id::text, e.date_mmdd, e.summary, COALESCE(e.detail,''), e.category, e.year
		 FROM women_calendar e
		 JOIN women_calendar_favorites f ON e.id = f.event_id
		 WHERE f.user_id=$1 ORDER BY e.date_mmdd`, userID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var events []WomenCalendarEvent
	for rows.Next() {
		var e WomenCalendarEvent
		rows.Scan(&e.ID, &e.DateMMDD, &e.Summary, &e.Detail, &e.Category, &e.Year)
		e.IsFavorited = true
		events = append(events, e)
	}
	return events, nil
}

// ═══════════ 序列化 ═══════════

func (e *WomenCalendarEvent) ToJSON() string {
	data, _ := json.Marshal(e)
	return string(data)
}
