---
title: Go 编译原理实现计算器(测试驱动讲解)
date: 2021-05-06T05:25:09+00:00
updated_date: 2022-03-26T18:22:41+00:00
image: None
summary: 本文不需要你掌握任何编译原理的知识。 只需要看懂简单的golang语言即可， 完整的代码示例在, 代码是从这本书抽取了简单的部分出来,  如果需要进一步了解,请详阅此书.听到编译原理，就觉得很高大上。记得上大学时，这门课要记忆一些BNF,LEX,AST,CFG这些有的没的。一个听不懂，二个没兴...
word_count: 3936
---
> **本文不需要你掌握任何编译原理的知识。 只需要看懂简单的golang语言即可， 完整的代码示例在, 代码是从这本书抽取了简单的部分出来,  如果需要进一步了解,请详阅此书**.


听到编译原理，就觉得很高大上。记得上大学时，这门课要记忆一些`BNF`,`LEX`,`AST`,`CFG`这些有的没的。一个听不懂，二个没兴趣。随着使用了几门语言之后，也尝试用编译原理的基本知识写过一个sql转es的工具之后。发现其实了解一点点编译原理的知识，能够提高我们的生产效率，做出一些很酷的小工具来。

本文将用golang和编译原理的基本技术实现一个计算器。虽然功能简单，网上也有很多人做过类似事情，但这篇博客会有三个优点：

- 我暂时没有找到有人用golang写
- 我会用最直白的语言去描述我们要做什么，这样当你阅读的时候，会发现该步骤和书中哪一步是对应的，帮助你更好的理解编译原理的知识。
- 我会用**测试驱动**整个博客和代码，会让大家看到如何慢慢得演化出这个计算器得解释器。就像小说中人物的黑化有一个发酵的过程才会好看，我希望在本文中能够让读者看到一个解释器编写发酵的过程。

<a name="73e82552"></a>
## 目标

整体会实现一个函数，输入一个`String`, 输出一个`int64`。

```go
// calc.go
func calc(input string) int64 {
}
```

而我们的终极目标是能够让我们的`calc`的方法能够通过以下的测试

```go
// calc_test.go
func TestFinal(t *testing.T) {
	tests := []struct{
		input string
		expected int64
	}{
		{"5", 5},
		{"10", 10},
		{"-5", -5},
		{"-10", -10},
		{"5 + 5 + 5 + 5 - 10", 10},
		{"2 * 2 * 2 * 2 * 2", 32},
		{"-50 + 100 + -50", 0},
		{"5 * 2 + 10", 20},
		{"5 + 2 * 10", 25},
		{"20 + 2 * -10", 0},
		{"50 / 2 * 2 + 10", 60},
		{"2 * (5 + 10)", 30},
		{"3 * 3 * 3 + 10", 37},
		{"3 * (3 * 3) + 10", 37},
		{"(5 + 10 * 2 + 15 / 3) * 2 + -10", 50},
	}

	for _, tt := range tests{
		res := Calc(tt.input)
		if res != tt.expected{
			t.Errorf("Wrong answer, got=%d, want=%d", res, tt.expected)
		}
	}
}
```

我们运行这个测试，毫无疑问会失败。不过没关系，我们先把这个测试放到一边，我们从编译器最简单的开始。

<a name="2e2b879f"></a>
## 把句子变成一个一个单词

首先我们注意到上面的测试中，我们包含多个字符。有`1-9 +-*/()`，并且`-`在数字前面表示这是一个负数。我们现在要做一个函数，将`input`的输入变成一个一个单词。那么一个计算输入有多少种单词呢？我们可以区分出以下几种。值得注意的是`EOF`表示结束,`ILLEGAL`表示非法字符。

```go
const (
	ILLEGAL = "ILLEGAL"
	EOF = "EOF"
	INT = "INT"

	PLUS = "+"
	MINUS = "-"
	BANG = "!"
	ASTERISK = "*"
	SLASH = "/"

	LPAREN = "("
	RPAREN = ")"
)
```

另外我们要设计一个读取字符器，更专业的名字叫做词法分析器。他的功能就是不断的读取每一个字符，然后生成我们的词元。注意我们有两个名词了，一个叫词元，一个叫词法分析器。我们都用结构体来描述他们。另外词法分析器的核心函数是`NextToken()`用于获取下一个词元。

```go
type Token struct {
	Type string  //对应我们上面的词元类型
	Literal string // 实际的string字符
}

type Lexer struct {
	input string // 输入
	position int   // 当前位置                                                                                                                                                                                                                                                                                                                                                                                               
	readPosition int  // 将要读取的位置
	ch byte //当前字符
}

func (l *Lexer) NextToken() Token {
}
```

我们不着急实现。照例我们先设计我们的测试。这次我们要达到的目标是我们能够将句子分成特定的词元。

```go
func TestTokenizer(t *testing.T) {
	input := `(5 + -10 * 2 + 15 / 3) * 2`
	tests := []struct {
		expectedType    string
		expectedLiteral string
	}{
		{LPAREN, "("},
		{INT, "5"},
		{PLUS, "+"},
		{MINUS, "-"},
		{INT, "10"},
		{ASTERISK, "*"},
		{INT, "2"},
		{PLUS, "+"},
		{INT, "15"},
		{SLASH, "/"},
		{INT, "3"},
		{RPAREN, ")"},
		{ASTERISK, "*"},
		{INT, "2"},
	}

	l := NewLex(input)

	for i, tt := range tests {
		tok := l.NextToken()

		if tok.Type != tt.expectedType {
			t.Fatalf("tests[%d] - tokentype wrong. expected=%q, got=%q",
				i, tt.expectedType, tok.Type)
		}

		if tok.Literal != tt.expectedLiteral {
			t.Fatalf("tests[%d] - literal wrong. expected=%q, got=%q",
				i, tt.expectedLiteral, tok.Literal)
		}
	}

}
```

ok ,   为了通过这个测试。我们来实现`NextToken()`这个函数，首先构建几个辅助函数。<br />首先我们给`lexer`提供一个动作函数`readChar`。这个函数不断读取字符，并且更新结构体的值

```go
func (l *Lexer) readChar() {
	if l.readPosition >= len(l.input) {
		l.ch = 0
	} else {
		l.ch = l.input[l.readPosition]
	}
	l.position = l.readPosition
	l.readPosition += 1
}
```

另外再来一个`skipWhitespace`用于在读取时候直接跳过空白字符

```go
func (l *Lexer) skipWhitespace() {
	for l.ch == ' ' || l.ch == '\t' || l.ch == '\n' || l.ch == '\r' {
		l.readChar()
	}
}
```

其实我们读取词源挺简单的，除了像`123`这种几位数字，其他都是单个字符做一个词元。我们搞一个函数专门来读数字，不过我们先搞一个函数判断字符是不是数字,这里原理很简单，如果是数字不断读下一个，读到不是数字为止。

```go
func isDigit(ch byte) bool {
	return '0' <= ch && ch <= '9'
}

func (l *Lexer) readNumber() string {
	position := l.position
	for isDigit(l.ch) {
		l.readChar()
	}
	return l.input[position:l.position]
}
```

好了。我们可以开始写`NextToken`这个核心函数啦。其实很简单，一个`switch`当前字符，针对不同字符返回不同的`Token`结构值

```
func (l *Lexer) NextToken() Token {
	var tok Token

	l.skipWhitespace()

	switch l.ch {
	case '(':
		tok = newToken(LPAREN, l.ch)
	case ')':
		tok = newToken(RPAREN, l.ch)
	case '+':
		tok = newToken(PLUS, l.ch)
	case '-':
		tok = newToken(MINUS, l.ch)
	case '/':
		tok = newToken(SLASH, l.ch)
	case '*':
		tok = newToken(ASTERISK, l.ch)
	case 0:
		tok.Literal = ""
		tok.Type = EOF
	default:
		if isDigit(l.ch) {
			tok.Type = INT
			tok.Literal = l.readNumber()
			return tok
		} else {
			tok = newToken(ILLEGAL, l.ch)
		}
	}

	l.readChar()
	return tok
}
```

OK. 在运行测试，测试就通过了，每个`input`都变成了每个词元。接下来我们要高出一个`ast`用于运行。

<a name="428f71b0"></a>
## 把一个一个词元组成语法树

<a name="97fa9467"></a>
### 什么是语法/语法树

首先语法到底是什么？比如说中文中`我爱你`主谓宾三种词表示一个意思，而必须按照`我爱你`这三个字顺序来表达，而不是用`爱你我`这种顺序来说。这个规则便是语法。而表达的意思便是如何告诉计算机你要干什么。<br />那什么是语法树呢？比如我们要计算机求`1 + 2`。你可以通过`1 + 2`这种中缀表达式写，或者是`+ 12` 这种前缀表达式来表达。但最后该语法的语言大概都会解析成一样的树

```
     +
   /    \
   1    2
```

而这样的树就是语法树，表示源代码`1+2`或者`+12`的抽象语法结构。

<a name="bd352d8b"></a>
### 那么计算表达式的语法是什么

首先我们定义两种情况。我们在有时候会见到这种语法`++i`。也就是某个操作符作为前缀与后面数字发生反应。同样还包括我们的`-1`。同时还有一种更加常见的情况`1 + 2`。操作符在中间。另外我只是是填写一个数字类似于`12`。这也是一个计算表达式。 我们先把这三种情况都定义出来。<br />首先统一使用一个接口。

```
type Expression interface {
	String() string
}
```

这个接口没什么特别的含义。另外我们依据上面考虑的三种情况实现三个结构体，另外都实现了`String`方法。

```
type IntegerLiteralExpression struct {
	Token Token
	Value int64
}

func (il *IntegerLiteralExpression) String() string { return il.Token.Literal }

type PrefixExpression struct {
	Token    Token
	Operator string
	Right    Expression
}

func (pe *PrefixExpression) String() string {
	var out bytes.Buffer

	out.WriteString("(")
	out.WriteString(pe.Operator)
	out.WriteString(pe.Right.String())
	out.WriteString(")")

	return out.String()
}

type InfixExpression struct {
	Token    Token
	Left     Expression
	Operator string
	Right    Expression
}

func (ie *InfixExpression) String() string {
	var out bytes.Buffer

	out.WriteString("(")
	out.WriteString(ie.Left.String())
	out.WriteString(" ")
	out.WriteString(ie.Operator)
	out.WriteString(" ")
	out.WriteString(ie.Right.String())
	out.WriteString(")")

	return out.String()
}
```

<a name="05a05a36"></a>
### 解析器

我们定义完了上面几种expression情况。接下来用一个结构`parser`来把我们的字符串变成`expression`。`parser`里面包含我们上一步的`lexer`。以及存储error的数组。当前的词元和下一个词元。另外针对于上面提到的两种不同的expression。利用不同的处理方法。

```
type Parser struct {
    l *lexer.Lexer
    errors []string
    curToken token.Token
    peekToken token.Token
    prefixParseFns map[token.TokenType]prefixParseFn
    infixParseFns map[token.TokenType]infixParseFn
}

// 往结构体里面筛处理方法
func (p *Parser) registerPrefix(tokenType token.TokenType, fn prefixParseFn) {
  p.prefixParseFns[tokenType] = fn
}
func (p *Parser) registerInfix(tokenType token.TokenType, fn infixParseFn) {
  p.infixParseFns[tokenType] = fn
}
```

另外我们的核心函数是将`lexer`要变成`ast`，这个核心函数是`ParseExpression`

```
func (p *Parser) ParseExpression(precedence int) Expression {
}
```

<a name="db06c78d"></a>
### 测试

好啦，准备工作已经做完了。那么开始写测试。我们刚才分析`计算表达式`只有三个语法。我们针对三个语法做三个简单测试

1. 针对单个数字例如`250`，我们进行以下测试。这个测试主要测试两个点，一个我们`ParseExpression`出来的是一个`InterLieralExpression`。另外一个这个`AST`节点的值为`250`。并且我们把`integerLiteral`的测试单独拿出来。之后可以服用

```
func TestIntegerLiteralExpression(t *testing.T) {
	input := "250"
	var expectValue int64 = 250

	l := NewLex(input)
	p := NewParser(l)


	checkParseErrors(t, p)
	expression := p.ParseExpression(LOWEST)
	testInterLiteral(t, expression, expectValue)
}

 
func testInterLiteral(t *testing.T, il Expression, value int64) bool {
	integ, ok := il.(*IntegerLiteralExpression)
	if !ok {
		t.Errorf("il not *ast.IntegerLiteral. got=%T", il)
		return false
	}

	if integ.Value != value {
		t.Errorf("integ.Value not %d. got=%d", value, integ.Value)
		return false
	}
	return true
}
```

2. 针对前缀表达式例如`-250`, 我们进行一下测试. 这个测试主要测试两个点，一个我们`ParseExpression`出来的右值是`InterLieralExpression`。操作符是`-`

```
func TestParsingPrefixExpression(t *testing.T) {
	input := "-15"
	expectedOp := "-"
	var expectedValue int64 =  15


	l := NewLex(input)
	p := NewParser(l)
	checkParseErrors(t, p)

	expression := p.ParseExpression(LOWEST)
	exp, ok := expression.(*PrefixExpression)

	if !ok {
		t.Fatalf("stmt is not PrefixExpression, got=%T", exp)
	}

	if exp.Operator != expectedOp {
		t.Fatalf("exp.Operator is not %s, go=%s", expectedOp, exp.Operator)
	}

	testInterLiteral(t, exp.Right, expectedValue)
}
```

3. 对于中缀表达式如`5+5`,进行如下测试，当然我们加减乘除都测试一遍

```
func TestParsingInfixExpression(t *testing.T) {
	infixTests := []struct{
		input string
		leftValue int64
		operator string
		rightValue int64
	}{
		{"5 + 5;", 5, "+", 5},
		{"5 - 5;", 5, "-", 5},
		{"5 * 5;", 5, "*", 5},
		{"5 / 5;", 5, "/", 5},
	}

	for _, tt := range infixTests {
		l := NewLex(tt.input)
		p := NewParser(l)
		checkParseErrors(t, p)

		expression := p.ParseExpression(LOWEST)
		exp, ok := expression.(*InfixExpression)

		if !ok {
			t.Fatalf("exp is not InfixExpression, got=%T", exp)
		}

		if exp.Operator != tt.operator {
			t.Fatalf("exp.Operator is not %s, go=%s", tt.operator, exp.Operator)
		}

		testInterLiteral(t, exp.Left, tt.leftValue)
		testInterLiteral(t, exp.Right, tt.rightValue)
	}
}
```

<a name="38164c8b"></a>
### 实现

上面测试写完了，我们就要开始实现了。首先想象一下，我们将input变成了一个一个的词元， 接下来我们对于一个又一个的词元进行处理。我们用到的算法叫做`pratt parser`。这里具体不展开来讲，有兴趣自己阅读。对于每一个词元，我们都有两个函数去处理她`infixParse`或者`prefixParse`。选择哪个函数取决于你在哪个位置。首先我们写一个初始化的函数`newParser`。

```
func NewParser(l *Lexer) *Parser {
	p := &Parser{
		l:      l,
		errors: []string{},
	}

	p.prefixParseFns = make(map[string]prefixParseFn)
	p.infixParseFns = make(map[string]infixParseFn)

	p.nextToken()
	p.nextToken()
	return p
}
```

<a name="780aa43f"></a>
#### 当遇到Integer Token

考虑当我们遇到IntegerExpression时候，就是`250` 这样当都一个字符。我们注册一下这种情况的处理函数`p.registerPrefix(INT, p.parseIntegerLiteral)`。 处理函数这里非常简单，我们直接返回一个`IntegerLiteralExpression`。

```
func (p *Parser) parseIntegerLiteral() Expression {

	lit := &IntegerLiteralExpression{Token: p.curToken}

	value, err := strconv.ParseInt(p.curToken.Literal, 0, 64)
	if err != nil {
		msg := fmt.Sprintf("could not parse %q as integer", p.curToken.Literal)
		p.errors = append(p.errors, msg)
		return nil
	}

	lit.Value = value
	return lit
}

// 在newParser里面加上
```

<a name="65bc6248"></a>
#### 当遇到`+-*/` Token

我们支持`-5` 这种形式。同时我们支持`5 -1`这种形式。我们在newParser里面注册两个处理函数。同样我们遇到`+ * /`其他三个token。采用`parseInfixExpression`

```
// func NewParser
	p.registerPrefix(MINUS, p.parsePrefixExpression)

	p.registerInfix(MINUS, p.parseInfixExpression)

	p.registerInfix(PLUS, p.parseInfixExpression)
	p.registerInfix(MINUS, p.parseInfixExpression)
	p.registerInfix(SLASH, p.parseInfixExpression)
	p.registerInfix(ASTERISK, p.parseInfixExpression)
```

如何实现`parsePrefixExpression`很简单，获取当前Token。也就是`-`。下一个TOken是数字。我们递归使用`ParseExpression`解析出来。不出错的话。这里解析出来的是一个`IntegerLiteral`

```
func (p *Parser) parsePrefixExpression() Expression {

	expression := &PrefixExpression{
		Token:    p.curToken,
		Operator: p.curToken.Literal,
	}
	p.nextToken()
	expression.Right = p.ParseExpression(PREFIX)
	return expression
}
```

`parseInfixExpression`差不多情况。但是有一个输入参数left。比如`1 + 2`。`1`就是left

```
func (p *Parser) parseInfixExpression(left Expression) Expression {

	expression := &InfixExpression{
		Token:    p.curToken,
		Operator: p.curToken.Literal,
		Left:     left,
	}

	precedence := p.curPrecedence()
	p.nextToken()

	expression.Right = p.ParseExpression(precedence)

	return expression
}
```

<a name="ee8ecb9e"></a>
#### 优先级

考虑这样一种情况`1 + 3 * 4`。如果解析成语法树。我们可以有两种解法

```
            * 
         /      \
        +       4
      /    \
     1      3
```

```
            + 
         /      \
        1       *
               /    \
             3      4
```

按照我们小学教育，我们应该选择下面的解法。也就是说乘法比加法要有更高的优先级。或者说在我们的语法树中乘法要比加法处于更高的位置。我们定义出以下几个级别的优先级，与各符号对应的优先级

```
const (
	_ int = iota
	LOWEST
	SUM         // +, -
	PRODUCT     // *, /
	PREFIX      // -X
	CALL        // (X)
)

var precedences = map[string]int{
	PLUS:     SUM,
	MINUS:    SUM,
	SLASH:    PRODUCT,
	ASTERISK: PRODUCT,
	LPAREN:   CALL,
}
```

<a name="68862320"></a>
#### 当遇到`（ ）` Token

我们支持`(1 + 5) * 3` 这种形式。这个时候我们强制提升了`1 + 5`的优先级。我们采用一个处理函数`parseGroupedExpression`

```
// func NewParser
    p.registerPrefix(MINUS, p.parseGroupedExpression)
```

如何实现用`()`来提升优先级，其实就是强制读取`()`内的内容

```
func (p *Parser) parseGroupedExpression() Expression {
	p.nextToken()
	exp := p.ParseExpression(LOWEST)

	if !p.expectPeek(token.RPAREN){
		return nil
	}
	return exp
}
```

<a name="256b0714"></a>
#### 递归主函数`ParseExpression`

我们通过当前优先级和下一个`token`的优先级进行对比，如果这个优先级比下一个优先级别低，那就变成infix。用`parseInfixExpression`处理。如果这个优先级等于或者比下一个优先级高，那就变成了prefix。用`parsePrefixExpression`处理

```
func (p *Parser) ParseExpression(precedence int) Expression {
	prefix := p.prefixParseFns[p.curToken.Type]
	returnExp := prefix()

	for precedence < p.peekPrecedence() {
		infix := p.infixParseFns[p.peekToken.Type]
		if infix == nil {
			return returnExp
		}

		p.nextToken()
		returnExp = infix(returnExp)
	}

	return returnExp
}
```

当然还有一些辅助函数，这里不再赘述。**运行一下测试，🆗通过啦**

<a name="f80c9435"></a>
## 执行语法树得到结果

这里我们直接要开始搞定我们最开始的测试啦。首先我们丰富一下主函数。

```
func Calc(input string) int64 {
	lexer := NewLex(input)
	parser := NewParser(lexer)

	exp := parser.ParseExpression(LOWEST)
	return Eval(exp)
}
```

关键就是我们的`Eval`函数啦。这里很简单，因为我们有三种`Expression`。对于不同的`Expression`做不同的处理方法

```
func Eval(exp Expression) int64 {
	switch node := exp.(type) {
	case *IntegerLiteralExpression:
		return node.Value
	case *PrefixExpression:
		rightV := Eval(node.Right)
		return evalPrefixExpression(node.Operator, rightV)
	case *InfixExpression:
		leftV := Eval(node.Left)
		rightV := Eval(node.Right)
		return evalInfixExpression(leftV, node.Operator, rightV)
	}

	return 0
}

func evalPrefixExpression(operator string, right int64) int64{
	if operator != "-" {
		return 0
	}
	return -right
}


func evalInfixExpression(left int64, operator string, right int64) int64 {

	switch operator {
	case "+":
		return left + right
	case "-":
		return left - right
	case "*":
		return left * right
	case "/":
		if right != 0{
			return left / right
		}else{
			return 0
		}
	default:
		return 0
	}
}
```

在运行一下测试，搞定。。。

<a name="25f9c7fa"></a>
## 总结

当然这里有很多东西没讲述，比如错误处理。但是我相信从上面走下来，比较容易理解编译原理的一些概念。

---
