# 轻材料 · 网申材料压缩

支持 PDF、PNG、JPG、JPEG 混合添加，按文件或 PDF 页面勾选、调整顺序，合并长图或分别导出 JPG / PNG。所有输出图片均严格不超过 200,000 字节。

文件转换、拼接、压缩、打包全部在浏览器本地完成。材料不上传服务器，无需登录或提供 API Key；刷新页面会清空当前材料和结果。

## 本地运行

```bash
python3 -m http.server 8765
```

打开 http://localhost:8765 。不要直接双击 index.html，PDF 工作线程需要通过 HTTP(S) 加载。

## GitHub Pages 发布

将本目录内容上传至仓库 main 分支根目录。在 Settings → Pages → Build and deployment 中选择 Deploy from a branch，选择 main 和 /(root)，然后保存。`.nojekyll` 用于直接发布静态资源。

后续更新同一分支中的网页文件，GitHub Pages 会自动重新发布。所有资源使用相对路径，支持仓库子路径访问。

## 项目结构

- `index.html`：页面结构
- `style.css`：样式与窄屏适配
- `app.js`：材料读取、勾选、排序、拼接、下载
- `compress.js`：200KB 压缩与大小检查
- `vendor/`：PDF.js 3.11.174、JSZip 3.10.1 及许可证

## 使用限制

单份文件最大 50MiB。加密 PDF 需先解除密码保护。长图内容越多，200KB 限制下清晰度越低，提交前请放大检查；也可以减少勾选项或改为分别导出。ZIP 限制针对其中每张图片，上传网申前请先解压。

第三方依赖许可证见 vendor/PDFJS-LICENSE.txt 与 vendor/JSZIP-LICENSE.txt。
