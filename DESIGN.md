---
name: "轻材料"
description: "奶油白与浅卡其构成的专业文档工作台（本地配色预览）"
colors:
  accent: "#594832"
  accent-hover: "#463723"
  accent-active: "#35291c"
  focus: "#8b7044"
  selected: "#eee7db"
  ink: "#1e1b14"
  muted: "#6b6050"
  canvas: "#fff8ef"
  surface: "#fff"
  soft: "#f4ede1"
  line: "#ded3c2"
  preview-ground: "#f4ede1"
  disabled-text: "#938675"
  disabled-bg: "#f0e9dd"
  disabled-border: "#e4dacb"
  danger: "#a42b2b"
  warning-text: "#825719"
  warning-bg: "#fff7e8"
  warning-border: "#ebd9b0"
  overlay-handle: "#b17d25"
typography:
  headline:
    fontFamily: "-apple-system, BlinkMacSystemFont, \"Segoe UI\", \"PingFang SC\", \"Microsoft YaHei\", sans-serif"
    fontSize: "30px"
    fontWeight: 650
    lineHeight: 1.4
    letterSpacing: "-.035em"
  title:
    fontFamily: "-apple-system, BlinkMacSystemFont, \"Segoe UI\", \"PingFang SC\", \"Microsoft YaHei\", sans-serif"
    fontSize: "17px"
    fontWeight: 650
    lineHeight: 1.5
    letterSpacing: "-.02em"
  body:
    fontFamily: "-apple-system, BlinkMacSystemFont, \"Segoe UI\", \"PingFang SC\", \"Microsoft YaHei\", sans-serif"
    fontSize: "14px"
    lineHeight: 1.8
  label:
    fontFamily: "-apple-system, BlinkMacSystemFont, \"Segoe UI\", \"PingFang SC\", \"Microsoft YaHei\", sans-serif"
    fontSize: "13px"
    fontWeight: 550
  annotation:
    fontFamily: "-apple-system, BlinkMacSystemFont, \"Segoe UI\", \"PingFang SC\", \"Microsoft YaHei\", sans-serif"
    fontSize: "12px"
    lineHeight: 1.8
rounded:
  tag: "4px"
  field: "6px"
  control: "7px"
  page: "8px"
  result: "10px"
  panel: "12px"
spacing:
  4: "4px"
  8: "8px"
  10: "10px"
  12: "12px"
  14: "14px"
  16: "16px"
  18: "18px"
  20: "20px"
  24: "24px"
  28: "28px"
  36: "36px"
  40: "40px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.surface}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "11px 17px"
  button-primary-hover:
    backgroundColor: "{colors.accent-hover}"
  button-primary-active:
    backgroundColor: "{colors.accent-active}"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "11px 17px"
  button-text:
    textColor: "{colors.muted}"
    rounded: "{rounded.tag}"
    padding: "7px 4px"
  field-number:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.field}"
    padding: "10px"
  format-navigation:
    backgroundColor: "{colors.soft}"
    rounded: "{rounded.control}"
    padding: "4px"
  status-badge:
    backgroundColor: "{colors.selected}"
    textColor: "{colors.accent}"
    rounded: "{rounded.tag}"
    padding: "4px 8px"
  panel:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.panel}"
    padding: "24px"
  mode-option:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "10px 12px"
---

# Design System: 轻材料

## Overview

**Creative North Star: "安静的文档工作台"**

以白纸与暖瓷色承托真实材料，用克制的深暖棕标明可执行动作和当前选择。界面保持专业、平静，文件预览与操作读数比装饰更醒目。

中文系统字体、细边界和柔和圆角形成一致的工作环境。空间随材料状态收放，桌面保留并行操作，手机按处理顺序展开；选中、禁用、处理中与结果过期均通过实际状态表达。

**Key Characteristics:**
- 白纸与暖瓷底色，深暖棕强调。
- 中文优先的系统字体和紧凑信息层级。
- 平面面板、细分隔与材料自身的轻微投影。
- 响应式工作区与明确的交互状态。

## Colors

暖瓷与白纸构成中性底色，深暖棕提供功能强调；所有色值以顶部 tokens 为准。

### Primary
- **深暖棕** (`accent` / `accent-hover` / `accent-active`)：主要生成与下载动作、可操作链接和活动编辑工具。
- **浅卡其选择色** (`selected`)：选择背景与结果达标标记。
- **暖棕焦点色** (`focus`)：键盘焦点，不与普通描边混用。

### Neutral
- **暖瓷底色** (`canvas`)：页面外围；**白纸** (`surface`)：主面板、结果与对话框。
- **柔米色** (`soft` / `preview-ground`)：格式选择轨道与预览承托。
- **炭墨** (`ink`)：主要文字；**暖灰** (`muted`)：说明、元数据和辅助操作。
- **细界线** (`line`)：面板边界与区块分隔。
- **禁用组** (`disabled-text` / `disabled-bg` / `disabled-border`)：原生不可操作状态。

### Functional Status
- **错误红** (`danger`)：错误提示与空选择提醒。
- **琥珀提醒** (`warning-text` / `warning-bg` / `warning-border`)：已有结果与当前材料或设置不一致的提示。
- **贴图琥珀** (`overlay-handle`)：所选贴图的外框与缩放手柄，区别于棕色裁剪框。

**The Functional Accent Rule.** 深暖棕用于主要操作、当前选择、可操作链接及焦点；浅卡其色承托选择状态。

## Typography

**Body and UI Font:** 使用顶部完整系统字体栈，中文优先使用本机苹方或微软雅黑。此系统字体选择由用户明确批准，同样适用于简短主标题，不新增展示字体。

### Hierarchy
- **Headline**：页面唯一主标题；紧凑桌面改为 26px，手机为 25px，窄屏为 23px。
- **Title**：主要面板标题；结果标题使用 20px，手机 19px。编辑器标题为 18px，手机 16px。
- **Body**：简短介绍和结果文件名；手机介绍为 13px。
- **Label**：常规控件与分组文字。手机主要生成动作与字段标签升为 14px。
- **Annotation**：文件元数据、说明和状态文字。长说明采用 1.8 行高；不是所有单行标签都强制此行高。

大小上限与排序数值采用等宽数字。编辑器数字输入桌面 14px，手机 16px；大小上限读数在最终层叠样式中为 23px。

**The Quiet Hierarchy Rule.** 以字号、字重、间距建立层级；辅助信息退为次级文字，避免为装饰增加标题层级。

## Layout

页面与页眉共用居中的 1328px 最大宽度、常规 40px 横向内边距。桌面采用可伸缩材料区与 340px 设置栏，间距 24px；设置栏距视口顶部 24px 粘附。材料面板通常内边距 24px，设置面板最终为 20px。常用间距在 4–40px 之间，按顶部 scale 取值；并非严格单一倍数网格。

- **≤1050px**：外围留白 24px，设置栏 310px，列间距 18px；材料面板内边距 20px。
- **≤780px**：外围留白 20px，主区域单列、间距 20px，设置栏取消粘附。页面缩略图为两列，结果卡为单列；模式选项并排。设置栏实际内边距仍为 20px，数字读数区高 48px，模式按钮至少 62px。
- **≤370px**：外围留白 14px，材料面板内边距 16px，模式选项变为单列，设置栏 18px。
- **≥1500px**：空材料面板最小高度 720px、空上传区 350px。
- **桌面宽 ≥781px 且高 ≤850px**：紧凑布局使用 60px 页眉、18px 设置内边距、14px 设置组距；模式并排并隐藏次级说明，生成动作至少 44px。此条件优先于大屏高度设置。

空上传区常规最小高度 312px，有材料后收缩为 76px 横向入口；手机分别为 255px 与 72px。材料缩略图常规自动填充不小于 155px 的列，≤1050px 时不小于 140px，手机明确两列；滚动区域最高 650px。结果列最小 280px；单个结果桌面可采用左预览、右信息，手机改为上下排列。

编辑对话框宽度最多 1240px / 96vw、高 94vh；主区与 300px 工具侧栏并排，≤1050px 时侧栏 280px。手机改为 98vw / 97vh，预览在上、设置在下，内部纵向滚动，底部保留保存操作。

## Elevation & Depth

工作台面板通过白色表面、浅背景及细边界分层，不使用装饰性面板阴影。微弱投影只帮助辨认材料的纸张边缘；对话框使用深色半透明背景，裁剪框通过遮罩显示保留范围。

### Shadow Vocabulary
- **缩略纸张**：`0 2px 4px #34281a16`。
- **结果纸张**：`0 2px 5px #34281a12`。
- **编辑纸张**：`0 3px 12px #34281a20`。
- **裁剪遮罩**：`0 0 0 2000px #30271a76`，只用于框外区域。

**The Paper Depth Rule.** 面板本身保持平面，投影用于预览中的纸张；遮罩用于明确编辑与预览层级。

## Shapes

面板与对话框采用柔和大圆角，页卡稍紧，控件再紧一级。顶部圆角 scale 是当前实现的实际分工：12px 面板、10px 结果、8px 页卡与上传区、7px 常规按钮、6px 编辑字段、4px 状态标签。格式子按钮与局部编辑按钮另有 5px 圆角；裁剪与贴图手柄为 2px 小方块。大部分边界为 1px；裁剪框为 2px 虚线。不要将所有圆角统一成一个值。

## Components

### Buttons

主要动作清晰、次要动作克制。常规按钮至少 44px 高，内边距见 tokens；生成按钮通常至少 48px。主按钮暖棕底白字，悬停变深、按下更深；次按钮白底炭墨字与细描边，悬停为柔米色。文字按钮默认辅助灰，悬停转棕并带浅底。禁用使用明确的灰色组与禁止指针；排序边界按钮另降低透明度。

所有可聚焦控件使用 3px 焦点轮廓与 3px 偏移；数字大读数输入的偏移为 1px。常规状态转换为 180ms 的背景、边框和文字变化，不移动按钮；减少动态效果时关闭转换与动画。

### Format Navigation and Mode Options

格式组是柔灰轨道中的单选按钮，选中项白底棕字、细边界。常规项至少 40px，手机至少 44px；使用 `aria-pressed` 同步真实选择。模式选项为整行可点击卡片，选择后浅卡其底、棕色边框及实心圆指示；短桌面与手机可并排，窄手机恢复单列。

### Cards / Containers

工作面板用白底、细边框、平面分层。页卡包含选择栏、居中且完整显示的纸张缩略图与操作行：已选边界变棕，排除项缩略图透明度降至 .45，同时保留复选框。结果卡用独立预览区、文件名、元数据、大小状态与下载操作。长文件名在列表可换行，在页卡简名可省略。

### Inputs / Fields

大小上限使用带单位的大数字输入与滑杆，两者共享暖棕强调和等宽数字。输入容器聚焦时边框变棕。编辑数字字段白底、浅边界、6px 圆角；手机提高字号与至少 44px 高度。复选框保留原生交互、17px 尺寸与棕色强调。

### Chips

结果大小标签为浅卡其底、暖棕字、4px 圆角和等宽数字；它是状态信息，不伪装成可点击筛选器。

### Upload Surface

空状态用大面积浅底与虚线边界容纳拖放或点击入口；悬停与拖入转为浅选择底和棕色边界。加载材料后入口收缩，释放空间给实际预览。添加动作配统一细描边 SVG 图标；图标不以字符或表情代替。

### Preview and Editor

预览与编辑沿用主工作台按钮、字级与细分隔。裁剪用棕色虚线与方角手柄，贴图选择用琥珀色外框与缩放手柄。手机裁剪手柄增至 20px、贴图缩放手柄 22px；键盘选中的贴图保留棕色可见焦点。编辑工具活动态暖棕底白字，悬停保持白字可读。

### Results Freshness

材料、选择或设置改变后，原结果保留，并显示琥珀提示要求重新生成；不要将旧结果继续表现为当前配置的结果。进度、错误与空选择使用明确文字和对应状态样式。

## Do's and Don'ts

### Do:
- **Do** 沿用白色面板、暖瓷背景与细描边，保持材料清晰可辨。
- **Do** 用真实选中、禁用与结果过期状态驱动视觉变化。
- **Do** 为键盘操作保留可见焦点，并尊重减少动态效果的偏好。
- **Do** 让手机中的设置、结果与编辑控件自然纵向排列。

### Don't:
- **Don't** 将主要操作的暖棕强调铺满大面积背景。
- **Don't** 用厚重阴影或营销装饰抢占材料工作区。
- **Don't** 用颜色替代选择控件、状态文字或明确操作名称。
- **Don't** 在新表面引入与现有中文系统字体无关的展示字体。


主题配色：底色来自 SLFG_Ts 的 #FFF8EF、#FAF3E7、#F4EDE1、#EEE7DB、#E8E2D6；暖黑文字 #1E1B14。操作色为配套派生的深暖棕 #594832。布局、文案及处理逻辑沿用已发布版本。

背景微调：页面外围保留 #FFF8EF；仅「你的材料」和「导出设置」主面板使用比外围更亮、微带黄色的象牙白 #FFFDF5，内部控件保持原色。

## 布局精简
任务顺序为「1. 整理材料 → 2. 导出 → 3. 下载」。桌面保持材料左、导出右，手机纵向排列。移除口号、副标题、空状态重复说明、重复隐私脚注与装饰页脚；隐私仅保留页眉。格式编码与压缩说明收入折叠帮助。上传后直接呈现勾选、排序和 PDF 编辑；成功进度条自动收起。结果仅保留一条清晰度提示和必要的过期提醒。主面板 #FFFDF5，外围 #FFF8EF。
验证：混合上传两页 PDF 与 PNG，取消其中一页后生成两项长图；结果195.6KB，小于200KB上限。切换PDF格式触发过期提醒，恢复原设置后提示复原。390px手机无横向溢出。

统一区域样式：整理、导出、下载共用 work-panel 与 panel-head；象牙白底、1px边框、12px圆角，桌面24px内边距与区块间距，手机20px、窄屏16px。标题统一17px（手机16px）；上方双栏等高对齐。结果使用完整外壳，内部预览及信息以留白分隔，不叠加第二层卡片描边。已检查1440px桌面和319px窄屏，三个区域计算样式一致，生成结果正常。

## 方向调整
每个材料项均提供折叠的“调整方向”入口：左转/右转90°、水平/垂直翻转与恢复方向。控件沿用暖棕、细边框与小圆角，手机点击区域至少44px。操作即时作用于当前项；修改后显示“方向已调整”，重新生成提示沿用现有状态。裁剪和贴图保持原始坐标，方向变换应用在合成后的整页，不覆盖其他页面。
