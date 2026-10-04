# JEV 小红书账号池

公开展示 AI、学术与法律 AI 内容账号，供筛选论文推广合作对象。

- 109 个账号：57 个主选、52 个备选；主页资料采集于 2026-10-04。
- 支持手机双列布局、Top 10 / Top 50、关键词与类别筛选。
- 支持主页截图预览、浏览器本地勾选、CSV 导出及打印为 PDF。
- 本仓库仅包含公开展示版本，不包含聊天证据、邮件记录、发件账号或内部报价。
- 勾选保存在当前浏览器中，不提供多人同步。

## Cloudflare Pages

连接本仓库，生产分支为 `main`。框架选择 `None`，构建命令留空，构建输出目录为 `public`，根目录留空。

网站不需要依赖安装、环境变量或服务端。提交到 main 后由 Pages 自动部署。

## 本地预览

在仓库根目录执行 `python -m http.server 8765 --directory public`，打开 http://localhost:8765 。

## 文件

- `public/index.html`：页面结构
- `public/assets/style.css`：响应式样式
- `public/assets/app.js`：筛选、勾选、导出与打印
- `public/assets/accounts.js`：公开展示数据
- `public/assets/profiles/`：109 张主页截图

原始截图与公开资料用于内容方向研究，不代表账号方已接受商业合作。
