# 语音合成配置指南

## 功能说明

项目已集成火山引擎的语音合成服务，使用**灿灿 2.0**（女童声）作为默认声音，更加儿童友好。

## 配置步骤

### 1. 创建语音合成应用

1. 访问 [火山引擎控制台](https://console.volcengine.com/)
2. 搜索「豆包语音」或「语音合成」
3. 进入「应用管理」，点击「创建应用」
4. 创建完成后，获取以下信息：
   - **AppID**（应用ID）
   - **Token**（访问令牌）
   - **Cluster**（集群，通常为 `volcano_tts`）

### 2. 配置环境变量

在 `.env` 文件中添加：

```bash
# 语音合成配置
VOLC_TTS_APPID=你的应用ID
VOLC_TTS_TOKEN=你的访问令牌
VOLC_TTS_CLUSTER=volcano_tts
```

### 3. 重启服务

```bash
npm start
```

## 声音选项

当前使用的是 **BV700_V2_streaming**（灿灿 2.0），其他儿童友好的声音选项：

| 音色名称 | voice_type | 特点 |
|---------|-----------|------|
| 灿灿 2.0 | BV700_V2_streaming | 女童声，活泼可爱，支持22种情感 |
| 天才少女 | BV421_streaming | 女童声，聪明伶俐 |
| 奶气萌娃 | BV051_streaming | 男童声，奶声奶气 |
| 天才童声 | BV061_streaming | 男童声，天真可爱 |

如需更换声音，修改 `services/ttsService.js` 中的 `voice_type` 参数。

## 降级方案

如果未配置火山引擎 TTS 或调用失败，系统会自动降级到浏览器自带的语音合成（质量较低）。

## 参考文档

- [火山引擎语音合成 API 文档](https://www.volcengine.com/docs/6561/79820)
- [音色列表](https://www.volcengine.com/docs/6561/97465)
