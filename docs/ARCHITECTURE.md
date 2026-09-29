# 实现说明

## 技术结构

- Next.js 16 App Router + React 19 + TypeScript。
- Tailwind CSS 4 管线与自定义响应式 CSS；lucide-react 图标。
- Supabase JS 浏览器客户端负责 Auth、PostgREST、Storage。服务端没有持有管理员密钥；写权限由数据库 RLS 控制。
- esptool-js 0.7 动态加载，仅进入设备连接流程才加载串口实现。SparkMD5 用于写后校验，Web Crypto 用于 SHA-256。

```
src/app/[[...route]]/page.tsx    路由分发与 404
src/components/                 发现、详情、账号、开发者后台、烧录 UI
src/lib/api.ts                  数据查询、发布与上传补偿
src/lib/supabase.ts             云端配置与 SDK
src/lib/validation.ts           项目、版本、地址与 Manifest 校验
src/lib/firmware.ts             全部二进制预校验
src/lib/demo.ts                 明确标记的只读示例数据
supabase/migrations/            PostgreSQL、RLS、私有 Storage
```

## 数据模型

| 对象                              | 用途与可见范围                                                                                       |
| --------------------------------- | ---------------------------------------------------------------------------------------------------- |
| profiles                          | 公开昵称，不区分大小写唯一；Auth 邮箱不复制到公开表；昵称依次取注册昵称、GitHub 用户名、`maker-xxxx` |
| projects                          | 公开项目；仅 owner_id 用户可编辑                                                                     |
| firmware_versions                 | 固件版本与嵌入式 Manifest；仅项目作者可发布，内容不可修改                                            |
| favorites                         | 仅本人可读写；汇总收藏数公开                                                                         |
| ratings                           | 公开评分；每个用户/项目唯一，只有本人可更新                                                          |
| comments                          | 公开文字评价；只能以当前身份提交                                                                     |
| flash_sessions                    | 仅本人可读、创建、将 started 更新到 success/failed                                                   |
| compatibility_reports             | 公开设备测试反馈；只能以当前身份提交                                                                 |
| project_stats                     | 只读公开汇总，只有内部触发器更新                                                                     |
| project_catalog / comment_catalog | 使用 security_invoker 的公开查询视图，继承底层 RLS                                                   |

版本文件以 `{user_id}/{project_id}/{release_id}/{filename}` 存储。私有 bucket 对已发布版本允许访客读取；未发布文件只有上传者可读/清理；不提供 UPDATE 策略，已发布文件不能删除。Manifest 在数据库触发器中再次验证芯片、波特率、文件名、大小、范围、不重叠、文件所属关系和实际 Storage 元信息。

项目表只按列授予写权限：客户端不能写入 `created_at`、修改 `id` / `owner_id`；`updated_at` 虽可写，但由 `guard_project` 触发器强制为当前时间。`color` 限定为界面支持的六种卡片颜色。注册时昵称重名会自动追加 4 位后缀，保证 `/user/{username}` 唯一对应一位作者。

`submit_review` 为普通 invoker 事务函数：一个用户重复评价会更新该项目的唯一评分并追加评论，统计不会重复计算评分。`set_release_online` 仅允许作者切换在线烧录。所有公开表显式启用 RLS、收窄 GRANT；Auth 自动建档、私有统计触发器需要 definer 权限，固定空 search_path 且不开放直接调用。

## 烧录状态与统计口径

```
idle → connecting → connected → flashing → success / error
```

连接失败、用户取消、芯片/容量不匹配均返回错误，关闭已打开的串口。确认硬件后，先完成全部文件预校验，再创建 started 记录，随后执行擦写。数据库写入失败会阻止开始擦写。写后校验通过才进入 success；记录同步失败会在日志中提示，不把数据库失败误判为设备失败。

- 累计烧录：开始实际烧录流程的会话数。
- 成功率：success / (success + failed)，不将仍处于 started 的中断会话算作失败。
- 浏览器强制退出/断电时可能留下 started，历史显示“未完成”。
- 兼容性统计：页面最近 100 条用户报告的统计，界面明确为“已展示记录”。与烧录会话是两个数据源，不互相冒充。

## 当前约束

没有服务端固件恶意代码扫描、付费、编译或硬件配置功能。客户端哈希不提供作者身份签名或安全背书；项目作者自己声明引脚/PCB 兼容性。设备协议只确认 ESP 芯片与 Flash 容量，无法自动识别定制 PCB。

上传与版本发布跨 Storage/PostgREST，失败时尝试清理未发布文件；网络断开导致补偿失败时可能留下仅作者可见的孤立对象。后续可增加定期清理任务。浏览器会话/反馈可被用户手工伪造，生产认证与风控需要后续引入可信设备证明、限流和举报治理。

本次不依赖远程字体或第三方图片，运行界面不要求外部资源网络连接。数据库与认证配置缺失时只显示示例，不用 localStorage 模拟多用户数据。
