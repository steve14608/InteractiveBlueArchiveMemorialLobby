# 声明

这个项目的资源文件来源于游戏《碧蓝档案》。《碧蓝档案》是一款由Nexon研发,Yostar代理发行的游戏。在此文件结构中只保留了少部分相关解包文件供参考，如果你需要全部文件，请自行寻找解包工具，并且根据已有的文件结构放入相对应的地方。

#  R.I.P

由于发现用Unity的webgl可以完美复现包括粒子在内的一系列特殊效果，该项目估计不会再更新了。

# 简介

使用vite框架的基于spine-pixi-v8的离线碧蓝档案可互动记忆大厅


## 特点

可互动，目前支持摸头，眼部跟随以及对话。

## 启动

和大多数vite项目一样，使用以下指令安装相关组件

```sh
npm install
```

然后输入以下指令运行

```sh
npm run dev
```

## 打包

执行以下指令即可打包。打包之后的项目无需构建服务器，直接打开index.html即可运行。

```sh
npm run build
```

# To-Do

目前还处于测试阶段，还在逐个配置各个学生，还未实现播放列表
