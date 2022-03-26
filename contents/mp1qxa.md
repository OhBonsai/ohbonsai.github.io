---
title: Go 定时任务
date: 2021-05-06T05:27:03+00:00
updated_date: 2022-03-26T18:30:56+00:00
image: None
summary: 本文基于Golang Crontab 实现了一个Crontab Job Manager。更加容易使用，同时也能够满足更加复杂的场景。仓储地址, 如果有用，欢迎点赞，欢迎讨论，欢迎找茬。需求在开发中，经常遇到一些需要定时任务的场景。各个语言都有定时语言的库，Golang Cron 提供了Cron...
word_count: 1392
---
> 本文基于[Golang Crontab](https://github.com/robfig/cron/tree/v2) 实现了一个Crontab Job Manager。更加容易使用，同时也能够满足更加复杂的场景。


[仓储地址](https://github.com/OhBonsai/croner), 如果有用，欢迎点赞，欢迎讨论，欢迎找茬。

<a name="e6cefb85"></a>
## 需求

在开发中，经常遇到一些需要定时任务的场景。各个语言都有定时语言的库，[Golang Cron](https://github.com/robfig/cron/tree/v2) 提供了Crontab Golang语言版本。这个库非常不错，提供最基本的定时任务编排的功能。但是一些复杂需求无法满足，比如

- 任何定时任务都有可能失败，失败了就panic了，这样非常不友好。最起码能够让我控制，失败是重试还是停止
- 某些任务执行周期要10s, 而用户设置的5s一执行，我能不能保证任何时间这个任务只执行一次
- 我想实时的看到任务的状态，比如是不是在运行？下次运行时间？上次运行时间？
- 我想看到任务执行了多少次，成功了多少次
- 我想要限制最大任务数量，比如超过10个任务在执行，不运行新的任务执行
- 任务执行完了可以告诉我逻辑上有错误，还是有结果。我还可以加上一些钩子函数来处理任务执行的结果

以上的需求都非常常见，可惜这个库都不支持`^_^.`

<a name="24bb89d3"></a>
## 完全没用的例子

复杂定义任务的场景模型抽象出来大概也就是下面几个功能点，这个没用的例子可以很好的体现出来

- 用户通过接口，告诉后台我要做一个什么定时工作，schedule是什么
- 查看所有定时任务的状态
- 查看所有定时任务的工作结果

<a name="26759572"></a>
#### 本地运行

通过以下命令本地运行

```
go get -u "github.com/OhBonsai/croner"
go get -u "github.com/gin-gonic/gin"
go get -u "github.com/gorilla/websocket"
cd $GOPATH/src/github.com/OhBonsai/croner/example

go run server.go 
# 打开localhost:8000
```

![](https://upload-images.jianshu.io/upload_images/3981759-cf668d205086d9bc.png?imageMogr2/auto-orient/strip%7CimageView2/2/w/1240#crop=0&crop=0&crop=1&crop=1&id=ifRMo&originHeight=740&originWidth=1240&originalType=binary&ratio=1&rotation=0&showTitle=false&status=done&style=none&title=)

<a name="7fa77e57"></a>
#### 前端解释

原谅我的狗屎前端。怕大家看不懂，我还是解释一下前端各个部分什么意思。

1. 图中①的区域，是计划定义区，可以设置一些参数，表示`谁多久往聊天室说一句什么话`。第二个表单可以输入`1-10`的数字，表示每隔几秒说话。当然`cron`支持六位的crontab周期定义。
1. 图中②的区域，是执行任务状态区，每秒刷新一次
1. 图中3的区域，就是我们的聊天室啦。后台定时任务钩子函数会定时把消息推到`channel`中，如果websocket服务端收到消息就发送到浏览器

<a name="aaf34108"></a>
#### 后端逻辑

1. 实现定时计划接口`func Run() croner.JobRunReturn`

```
type JobS struct {
	Duration int    `json:"duration"`
	Who      string `json:"who"`
	What     string `json:"what"`
}

func (j JobS) Run() croner.JobRunReturn {
	return croner.JobRunReturn{
		Value: fmt.Sprintf("[%s] %s: %s", time.Now().Format(time.RFC850), j.Who, j.What),
	}
}
```

2. 初始化设置

```
var manager = croner.NewCronManager(croner.CronManagerConfig{
	true, false, 0, 0,
})
```

3. 加上钩子函数，如果接收到任务执行结果，将结果传到`ch` channel

```
croner.OnJobReturn(func(runReturn *croner.JobRunReturnWithEid) {
	say := runReturn.Value.(string)
	ch <- say
})
```

4. 每当接受到post请求，就创建一个任务

```
_, err = manager.Add(fmt.Sprintf("@every %ds", curJob.Duration), curJob, nil)
```

5. 轮询获区`ch`传过来的值，通过websocket传到前端

```
for {
	select {
	case msg := <-ch:
		conn.WriteMessage(websocket.TextMessage, []byte(msg))
	default:
		continue
	}
}
```

<a name="38164c8b"></a>
## 实现

详细的使用可以查看[测试文件](https://github.com/OhBonsai/croner/blob/master/manager_test.go)，

<a name="06dd99e2"></a>
#### 任务接口

任务只要实现`run()`函数就行啦。这样我就可以包装你这个函数

```
type JobRunReturn struct {
	Value interface{}
	Error error
}

type JobInf interface {
	Run() JobRunReturn
}
```

<a name="52aab7c4"></a>
#### 任务失败控制

`Cron`没有失败控制，通过包装`run()`函数来实现`cron`的job接口来增加一些逻辑。加上一个`defer`来恢复`panic`, 通过设置配置`ignorePanic`来控制是否忽略错误继续执行，还是发生错误就是`STOP`

```
	defer func() {
		j.TotalCount += 1
		if err := recover(); err != nil {
			errString := fmt.Sprintf("WrappedJob-%d %s  execute fail. error is %s", j.Id, j.Name, err)
			println(errString)
			atomic.StoreUint32(&j.status, FAIL)
			if !j.father.ignorePanic {
				j.father.DisActive(j.Id)
			}
			j.father.jobReturnsWithEid <- JobRunReturnWithEid{
				JobRunReturn{nil, JobRunError{errString}},
				j.Id,
			}
		}
		return
	}()
```

<a name="2831f123"></a>
#### 单任务周期时间只执行一次

这个主要靠锁来实现，任务运行时就锁住，直到完成之后才释放

```
j.running.Lock()
defer j.running.Unlock()
```

<a name="70079b7b"></a>
#### 任务状态变更

通过原子操作来变更任务状态

```
atomic.StoreUint32(&(j.status), RUNNING)
defer atomic.StoreUint32(&(j.status), IDLE)
```

<a name="7d1236ff"></a>
#### 最大任务数量

通过`buffered channel`来实现最大任务数量

```
permit = make(chan struct{}, c.PoolSize)
permit <- struct{}{}
defer func() { <-permit }()
```

<a name="85fed6ba"></a>
#### 钩子

不断获取任务回传结果，然后遍历执行钩子函数

```
	go func(){
		for {
			select {
			case value := <-r.jobReturnsWithEid:
				jobReturnHooks.Run(&value)
			case <-r.stop:
				return
			}
		}
	}()
```

<a name="615ae134"></a>
## 缺陷

**超时停止**，本来尝试做的，配置里面都预留了这个字段。结果发现有问题。这个貌似要修改croner的源码，我不想这么做，但又想不出其他实现方案，我毕竟刚使用golang编程。如果有读者碰到类似问题或者有想法留言提醒我呀

**OnlyOne** 单次执行的时候，下次执行的时间就无法预测了。这个时候把任务的`Next`设置为一个不可能的值，比如1970-0-0。但如果在周期内执行完了，下次执行时间就准了...这貌似没办法解决。我也不知道任务什么时候执行完。

学习强大的`APScheduler`, `Quartz`

---
