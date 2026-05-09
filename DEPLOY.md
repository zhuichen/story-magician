# 故事魔法师 Docker 部署指南

## 快速部署（使用 Docker Compose）

### 1. 配置环境变量

复制环境变量示例文件并填写你的 API 密钥：

```bash
cp .env.example .env
```

编辑 `.env` 文件，填入以下配置：

```env
# 字节跳动 Ark 大模型（必填）
ARK_API_KEY=your_ark_api_key_here
ARK_MODEL=doubao-seed-2-0-lite-260215

# 火山引擎（文生图/视频，必填）
VOLC_ACCESS_KEY_ID=your_volc_access_key_id
VOLC_SECRET_ACCESS_KEY=your_volc_secret_access_key

# 服务端口（可选，默认 3200）
PORT=3200

# 是否开启文生视频（可选，默认 false）
ENABLE_VIDEO=false
```

### 2. 构建并启动容器

```bash
# 一键部署
npm run deploy

# 或者分步执行
npm run docker:compose:build
npm run docker:compose:up
```

### 3. 验证部署

```bash
# 查看容器状态
docker-compose ps

# 查看日志
docker-compose logs -f

# 测试访问
curl http://localhost:3200
```

### 4. 访问应用

- **本地访问**: http://localhost:3200
- **局域网访问**: http://你的服务器IP:3200
- **iPad 访问**: 在 Safari 中打开 http://你的服务器IP:3200，然后"添加到主屏幕"

---

## 云服务器部署

### 阿里云/腾讯云部署步骤

1. **安装 Docker**
   ```bash
   curl -fsSL https://get.docker.com | sh
   sudo systemctl enable docker
   sudo systemctl start docker
   ```

2. **安装 Docker Compose**
   ```bash
   sudo curl -L "https://github.com/docker/compose/releases/download/v2.20.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
   sudo chmod +x /usr/local/bin/docker-compose
   ```

3. **上传项目文件**
   - 可以使用 scp、rsync 或 git clone 方式上传

4. **配置环境变量**
   - 编辑 `.env` 文件填入你的 API 密钥

5. **启动服务**
   ```bash
   npm run deploy
   ```

6. **配置防火墙**
   - 在云控制台开放 3200 端口（或你自定义的端口）

7. **域名绑定（可选）**
   - 配置 Nginx 反向代理
   - 申请 SSL 证书启用 HTTPS

---

## Nginx 反向代理配置（可选）

如果你需要域名访问和 HTTPS，可以配置 Nginx：

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://127.0.0.1:3200;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_cache_bypass $http_upgrade;
    }
}
```

---

## Docker 命令速查

```bash
# 启动服务
docker-compose up -d

# 停止服务
docker-compose down

# 重启服务
docker-compose restart

# 查看日志
docker-compose logs -f

# 重新构建
docker-compose down && npm run docker:compose:build && docker-compose up -d

# 进入容器调试
docker exec -it story-magician sh

# 清理旧镜像
docker image prune -f
```

---

## 数据持久化

- **会话历史**: 挂载到 `./data` 目录
- **日志文件**: 挂载到 `./logs` 目录

确保这些目录存在或 Docker 有权限创建：

```bash
mkdir -p data logs
chmod 755 data logs
```

---

## iPad 使用指南

### 方法一：添加到主屏幕（推荐）

1. 在 iPad Safari 中打开应用
2. 点击 Safari 工具栏的"分享"按钮 📤
3. 向下滚动，点击"添加到主屏幕" ➕
4. 点击"添加"完成
5. 现在可以从主屏幕像原生应用一样打开

### 方法二：全屏模式

1. 打开应用后，点击 Safari 工具栏的"分享"按钮 📤
2. 选择"在默认浏览器中打开"（iOS 16+）
3. 或在 Safari 设置中启用"桌面模式"

### 方法三：局域网访问

如果部署在家庭服务器上：

1. 确保 iPad 和服务器在同一 WiFi 网络
2. 获取服务器 IP 地址
3. 在 iPad Safari 中访问 `http://服务器IP:3200`
