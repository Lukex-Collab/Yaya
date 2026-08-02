// Package safetyfilter — 中文内容安全过滤
// 参考 go-swd (github.com/17603127956/go-swd) 的 Trie 树 + DFA 算法思路
// 集成到对话管线：用户消息 → 安全过滤 → AI 调用
package safetyfilter

import (
	"strings"
	"sync"
	"unicode/utf8"
)

// Filter 基于 DFA（Deterministic Finite Automaton）的敏感词过滤器
// 支持中文，O(n) 时间复杂度，n = 文本长度
type Filter struct {
	mu   sync.RWMutex
	root *trieNode
}

type trieNode struct {
	children map[rune]*trieNode
	isEnd    bool
}

func New() *Filter {
	return &Filter{root: &trieNode{children: make(map[rune]*trieNode)}}
}

// AddWord 添加敏感词
func (f *Filter) AddWord(word string) {
	f.mu.Lock()
	defer f.mu.Unlock()

	node := f.root
	for _, r := range word {
		if node.children[r] == nil {
			node.children[r] = &trieNode{children: make(map[rune]*trieNode)}
		}
		node = node.children[r]
	}
	node.isEnd = true
}

// AddWords 批量添加
func (f *Filter) AddWords(words []string) {
	for _, w := range words {
		f.AddWord(w)
	}
}

// Contains 检查文本是否包含敏感词
func (f *Filter) Contains(text string) bool {
	f.mu.RLock()
	defer f.mu.RUnlock()

	runes := []rune(text)
	for i := 0; i < len(runes); i++ {
		node := f.root
		for j := i; j < len(runes); j++ {
			if node.children[runes[j]] == nil {
				break
			}
			node = node.children[runes[j]]
			if node.isEnd {
				return true
			}
		}
	}
	return false
}

// Replace 将敏感词替换为 ***
func (f *Filter) Replace(text string) string {
	f.mu.RLock()
	defer f.mu.RUnlock()

	runes := []rune(text)
	matches := make([]bool, len(runes))

	// 扫描所有匹配位置
	for i := 0; i < len(runes); i++ {
		node := f.root
		endPos := -1
		for j := i; j < len(runes); j++ {
			if node.children[runes[j]] == nil {
				break
			}
			node = node.children[runes[j]]
			if node.isEnd {
				endPos = j
			}
		}
		if endPos >= 0 {
			for k := i; k <= endPos; k++ {
				matches[k] = true
			}
		}
	}

	// 替换
	var result strings.Builder
	result.Grow(utf8.RuneCountInString(text))
	for i, r := range runes {
		if matches[i] {
			result.WriteString("*")
		} else {
			result.WriteRune(r)
		}
	}
	return result.String()
}

// ValidateContent 内容校验
// 返回: (是否通过, 拒绝原因)
func (f *Filter) ValidateContent(input string) (bool, string) {
	text := strings.TrimSpace(input)

	if len(text) == 0 {
		return false, "消息不能为空"
	}
	if utf8.RuneCountInString(text) > 2000 {
		return false, "消息不能超过2000字"
	}
	if f.Contains(text) {
		return false, "消息包含违规内容"
	}
	return true, ""
}

// DefaultFilter 默认过滤器，预加载常见敏感词类型
var DefaultFilter *Filter

func init() {
	DefaultFilter = New()
	// 仅示例——生产环境从配置中心加载词库
	DefaultFilter.AddWords([]string{
		// 基础违禁词（示例占位，实际词库从配置加载）
	})
}

// Validate 使用默认过滤器校验
func Validate(input string) (bool, string) {
	return DefaultFilter.ValidateContent(input)
}
