# KeyFlash

ESP32 键盘固件社区与在线烧录平台，按 `ESP32_键盘固件社区_PRD_V0.1.md` 的第一阶段 MVP 开发。

## 本地启动

使用 Node.js 22 或更新版本：

```bash
npm ci
npm run dev
```

打开 http://127.0.0.1:3000 。没有 Supabase 环境变量时，自动进入**只读示例环境**：6 个项目可以搜索、筛选和查看详情。示例项目、评价和统计不代表真实社区数据，不提供二进制文件，不会伪造注册、上传或烧录成功。

## 已实现的 MVP

| 功能           | 实现                                                                                            |
| -------------- | ----------------------------------------------------------------------------------------------- |
| 发现与搜索     | 关键词、芯片、设备、功能、项目状态组合筛选；按发布、更新、烧录、收藏、评分排序                  |
| 项目详情       | 作者、硬件、芯片、功能、License、仓库与官网、版本、评价、兼容性记录                             |
| 账号           | Supabase 邮箱注册、登录、退出、邮件验证、找回与重置密码                                         |
| 项目管理       | 创建、编辑、归档项目；查看项目数量、累计烧录、收藏、已完成烧录成功率                            |
| 版本发布       | 多 BIN 上传、地址配置、稳定/Beta/实验版、更新日志、兼容硬件、在线烧录开关                       |
| 固件安全       | 每个文件 16 MB 上限、最多 8 个文件、扇区对齐、范围与重叠校验、SHA-256、发布后文件不可变         |
| 固件下载       | 访客可下载公开版本，下载前校验 SHA-256                                                          |
| 在线烧录       | Web Serial + esptool-js；识别芯片与容量、全部文件预校验、写入、MD5 校验、重启、日志、进度和速度 |
| 收藏与用户中心 | 账号独立收藏、烧录历史与版本、开发者项目列表                                                    |
| 评论评分       | 登录后发表评论与五星评分；评分按用户/项目去重更新，评价以事务提交                               |
| 兼容性         | 版本、芯片、PCB、系统、浏览器、USB 芯片、蓝牙、RGB、旋钮、成功/失败和备注                       |
| 响应式界面     | 中文界面、桌面侧栏、手机导航、空状态、错误状态与键盘焦点                                        |

`/`、`/explore`、`/projects` 为发现页面；`/project/{slug}` 及其 `/versions`、`/flash`、`/reviews`、`/compatibility` 为项目页面。另有 `/dashboard`、`/dashboard/projects/new`、`/dashboard/projects/{id}`、`/favorites`、`/history`、`/user/{username}`、`/login`、`/guide`。

## 连接 Supabase

1. 新建一个**专用的空 Supabase 项目**。不要直接把初始迁移应用到已有业务数据库。
2. 使用 Supabase CLI 关联项目并应用迁移：

   ```bash
   npx supabase login
   npx supabase link --project-ref YOUR_PROJECT_REF
   npx supabase db push
   ```

   也可在该项目的 SQL Editor 执行 `supabase/migrations/20260924054828_initial_keyflash.sql`。迁移会创建业务表、RLS、视图、触发器和私有 `firmware` Storage bucket。

3. 复制环境文件，填写项目 URL 和 **publishable key**：

   ```bash
   cp .env.example .env.local
   ```

   ```dotenv
   NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
   ```

   浏览器不需要 `service_role` 或 secret key，不要把它们填入 `NEXT_PUBLIC_*`。

4. 在 Auth URL Configuration 中设置 Site URL，并允许以下回调：
   - `http://127.0.0.1:3000/login`
   - `http://127.0.0.1:3000/login?mode=recovery`
   - 上线时添加实际 HTTPS 域名下对应的两个地址。
5. 启用邮箱/密码登录；生产环境配置 SMTP。重启 `npm run dev`。现在列表会读取真实数据库，不会混入示例项目。
6. 注册并验证邮箱，进入工作台创建项目，然后上传自己的真实固件。

本地 Supabase 也可使用：安装并启动 Docker 后运行 `npx supabase start`，将其输出的 API URL 和 publishable/anon key 填入 `.env.local`。本仓库不要求 Docker 才能运行示例环境或 SQL 权限测试。

## 发布与烧录

- 当前 ESP32 烧录支持原始 **BIN**。HEX / UF2 不会直接写入；需先使用适当工具转换为 BIN。
- 按构建输出的 `flash_args` / `flasher_args.json` 设置地址，表单默认值仅供参考。合并镜像通常从 `0x0` 写入，实际地址以具体固件为准。
- 发布后不能覆盖或删除文件、修改版本号或 Manifest；修正内容请发布新版本。作者可以关闭某个版本的在线烧录，或将项目设为归档。
- 每次写入前先下载**所有**文件并验证 SHA-256，任何文件不匹配都不会进入擦写步骤。设备芯片必须匹配，固件范围不能超过实际 Flash 容量。
- 默认只擦除写入涉及的扇区；勾选“擦除全部 Flash”才会清空全部配置。
- 写入后由 esptool-js 校验设备 MD5，失败不会显示成功。自动重启失败时会提示手动重启。
- Chrome / Edge 桌面版，HTTPS 或 localhost。内嵌预览浏览器可能不开放 Web Serial，实机测试请在独立 Chrome / Edge 窗口中打开。

## 验证

```bash
npm run typecheck
npm test
npm run build
npm run test:e2e
npm run test:integration
```

- 单元/集成测试：固件地址与哈希预校验、恶意链接、数据库迁移与 RLS、多用户隔离、公开汇总统计、固件不可变与烧录开关。使用 PGlite 执行真正的 PostgreSQL SQL，测试中的 `auth` / `storage` 外壳模拟 Supabase 基础表。
- 浏览器测试：桌面与 390px 手机视口下的搜索组合筛选、版本/烧录入口、登录门禁、导航、溢出检查和 404。使用已安装的 Google Chrome；缺少 Chrome 时先运行 `npx playwright install chrome`。
- `npm run test:e2e` 面向未配置 Supabase 的示例环境。
- `npm run test:integration` 在隔离的 3001 端口启动测试应用，通过模拟 Supabase 协议验证登录、创建项目、上传版本、下载、收藏、评价与兼容性提交；不会访问云端或操作硬件。真实后端按 `docs/ACCEPTANCE.md` 验收。

**验证边界：** 仓库代码已实现真实接口，但尚未连接云端 Supabase 项目或实体 ESP32。数据库测试不等同于 Supabase Auth / Storage 服务联调，也不等同于实机烧录成功。

## 部署

项目可作为标准 Next.js 应用部署到 Vercel：导入仓库、配置上述两个环境变量、使用 `npm run build`。生产域名必须使用 HTTPS，并加入 Supabase Auth 回调白名单。环境变量变更后重新构建。也可通过 `npm run build && npm start` 在 Node 服务上运行，前置 HTTPS 反向代理。

目前未执行公网部署。详细结构和权限说明见 `docs/ARCHITECTURE.md`，验收步骤见 `docs/ACCEPTANCE.md`。

## 后续阶段

PRD 第二阶段的 Issue、关注作者、排行榜、项目认证、OTA、GitHub Release 同步，以及管理员后台、举报工作流、图片评论/回复、独立 App 管理，尚未实现。当前评分为 MVP 五星制，未扩展子评分；兼容性与烧录统计均来自客户端报告，不代表平台对固件安全性的背书。
