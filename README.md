# 台灣日常：天氣、地方新聞與颱風動態

以咖哩東＆氣象象的 MIT 授權 v0.69 改作，保留地圖、暴風圈、70% 機率範圍、強度圖表、歷次預報比較，以及 JSON 載入／下載。

## 運作方式

GitHub Actions 預計每 15 分鐘（UTC 每小時第 11、26、41、56 分）向中央氣象署 W-C0034-005 檢查資料，合併同一颱風的歷次預報，再發布 `site/` 到 GitHub Pages。首頁現為日常資訊入口；完整原版工具移至 `typhoon.html`。每次成功抓取（包含預報未變）都發布實際檢查時間。另有每 30 分鐘的過期檢查；超過 45 分鐘未成功抓取且沒有更新工作排隊或執行時，會補觸發主流程。網頁每 10 分鐘重讀網站 JSON。關閉電腦和瀏覽器後仍可更新。實際 GitHub 排程可能延遲或漏跑。

這是**定時檢查氣象資料與部署網站**；原作者未來的新 HTML 版本不會自動合併，需另行比較與測試。

## 啟用

1. 到 [氣象署開放資料平台](https://opendata.cwa.gov.tw/index) 註冊並取得自己的授權碼。
2. 在本 repository 的 **Settings → Secrets and variables → Actions → New repository secret**，名稱填 `CWA_API_KEY`，值填授權碼。請勿把授權碼貼進原始碼、issue、README 或聊天。
3. **Settings → Pages → Source** 選 **GitHub Actions**。
4. **Actions → Update CWA data and deploy Pages → Run workflow**，等待 build 和 deploy 都成功。
5. 確認網站不再顯示「範例資料」，並顯示最近成功檢查的臺灣時間。只新增 Secret 不會立刻觸發 workflow，可手動執行或等下次排程。

未填 Secret 時所有更新都會失敗，保留原有網站，不會假裝已取得即時資料。第一次成功 API 更新會排除範例，改從已驗證的 API 資料累積紀錄。原範例仍可從 Git 歷史取得。

## 資料保存與失敗處理

- `site/data/archive.json` 保留所有成功抓到的颱風與預報版本。以年份、颱風／低壓編號合併，同一預報起報時間接受較新發布的修正。TD 升格 TY 時沿用原作的配對邏輯。
- 正常空資料會顯示 API 回傳 0 個熱帶氣旋，歷史紀錄仍保留。歷史清單不等於目前仍有活動颱風。
- API 錯誤、授權失敗、格式異常不改寫資料；更新失敗時不執行新部署，既有網站可繼續瀏覽。
- 超過 90 分鐘未成功檢查或檢查時間異常會提示排程／抓取／部署可能延遲；有活動氣旋但官方資料時間超過 12 小時亦提示。成功檢查時間不同於氣象署發布時間。
- 每次成功檢查都提交並部署，不再略過一小時內內容相同的檢查。網頁顯示官方資料時間及其依據；重讀相同網站 JSON 不代表官方沒有新預報。
- 氣象署只提供當期資料；部署前或排程漏抓的舊版預報無法保證補回。

## 安全與限制

授權碼只由 Actions step 的環境變數提供，以 Authorization header 傳給氣象署；不置於 URL、不寫入網站，不輸出完整錯誤回應。只部署 `site/`，不部署執行腳本或環境檔。回應若包含授權碼會拒絕發布。更新排程未開放 pull request 觸發，也未使用第三方代理服務。

GitHub Actions 可能延遲或漏跑，非即時防災系統。公開 repository 若連續 60 天沒有活動，排程可能被停用；請留意 Actions 狀態與失敗通知。正常成功檢查會有資料 commit，但長期失敗或沒有排程執行仍需檢查。D3 與字型仍依賴外部 CDN；地圖可用性依賴網路。

使用已驗證可連線的 REST datastore API。該回應未提供 `Sent` 時，以最新起報／觀測時間作為資料時間，保留發布時間為空值，網站會明示時間依據；絕不將抓取時間冒充官方發布時間。同一起報的修正可在下次檢查合併。

官方資料通常每 6 小時更新，颱風警報期間每 3 小時更新。每 15 分鐘嘗試檢查不代表每 15 分鐘有新預報。本網站不是氣象署官方產品；防災決策以官方公告為準。

## 本機驗證

Node.js 22 以上，無須安裝 npm 套件：

```text
node --test
python -m http.server 8080 --directory site
```

測試包含原始六版樣本往返、合併去重、時間轉換、無颱風／格式錯誤區分，以及憑證安全檢查。測試中的虛構資料僅用於驗證格式，不發布為氣象資料。尚未設定授權碼前，不能宣稱真實 API 驗證成功。

## 來源與授權

- [原始 HTML、說明書與六版 JSON 分享檔](https://drive.google.com/file/d/1AmJ8i9w8okF1hbknBiWdXZKJZMGnuBXa/view)
- Copyright (c) 2026 咖哩東＆氣象象 / Ikaridon Yu & Weatherelephant，MIT License，全文見 LICENSE 與 HTML 開頭。
- [中央氣象署 W-C0034-005 產品說明](https://opendata.cwa.gov.tw/opendatadoc/Warning/W-C0034-005.pdf)，資料依政府資料開放授權條款使用。
- 海岸線 Natural Earth（公眾領域）、world-atlas（ISC）、D3.js（ISC）、Noto Sans TC 與 IBM Plex Mono（SIL OFL）。
- [GitHub Pages Actions 部署文件](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)
- [GitHub 排程限制](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows)

## 排程補救與驗證（2026-10-22）

- 主流程 `.github/workflows/update-and-deploy.yml` 保留錯峰的 15 分鐘排程，也接受手動執行與 `repository_dispatch`（事件型別 `cwa-refresh`）。只從 main 抓最新歷史，避免排隊工作取到舊 archive。
- 補救流程 `.github/workflows/recover-stale-data.yml` 於 UTC 每小時第 7、37 分讀取 main 的 archive；repo 或公開 Pages 超過 45 分鐘未更新（或 Pages 無法確認）時，使用內建 GITHUB_TOKEN 補觸發主流程，無需新增或公開 CWA 金鑰。可在 Actions 手動執行此流程驗證補抓。
- 兩個流程仍共用 GitHub 排程服務；若服務整體漏觸發，兩者都可能延遲。這是補救機制，不是準時保證。需要獨立排程時，可由外部排程以具 Actions write 權限的專用 GitHub 憑證呼叫 workflow_dispatch；CWA_API_KEY 一律留在 GitHub Actions Secrets。本次未配置第三方服務或外部憑證。
- 補抓判斷讀取 repo archive；Pages 部署另以主流程 deploy 結果和公開網站 checkedAt 核對。抓取成功不代表部署成功。補救流程會在 Actions 警告中留下補觸發紀錄，請查看後續主流程是否完成。
- 發布前必須成功抓取；缺少金鑰不再以 push 略過抓取。API 失敗維持既有 archive 和 Pages。


## 台灣日常改版（2026-10-22）

### 定位與本次範圍

平時可查看 22 縣市今明 36 小時預報、官方警報發布與解除動態、地方與生活新聞；有熱帶氣旋時，首頁加上動態入口及逐點路徑播放。沒有活動氣旋不隱藏日常資訊，所有歷史預報仍在完整工具內保留。

首頁 `site/index.html` 使用獨立的 `portal.mjs` / `portal-core.mjs` / `portal.css`；既有 MIT 颱風工具保留於 `site/typhoon.html`，JSON 格式不變。首頁縣市選擇保存在瀏覽器 localStorage，不上傳定位，也不要求登入。

### 資料與狀態

| 來源 | 公開內容 | 時間語義 |
| --- | --- | --- |
| CWA F-C0032-001 | 22 縣市各時段天氣、溫度上下限、降雨機率、舒適度 | 各時段 start/end 是有效時間，不能當發布時間；溫度是預報，非實測 |
| CWA 警報 RSS | 原標題、發稿時間、原文連結 | 含發布及解除紀錄，不等同有效警報清單；不由 RSS 推導縣市警戒 |
| 中央通訊社地方／生活 RSS | 原標題、來源、時間、原文連結 | 僅非商業標題聚合，不儲存／重製全文或照片；縣市關聯只比對標題，可能遺漏 |
| CWA W-C0034-005 | 既有熱帶氣旋與歷次預報 | API 活動清單與歷史分開；播放為官方逐點，不延長或生成額外預報 |

中央社 RSS 官方規範：https://www.cna.com.tw/about/rss.aspx 。氣象署 RSS 規範：https://www.cwa.gov.tw/V8/C/S/eservice/rss.html 。新聞及警報點擊均回到原發布者。若未來要商業營運，需重新確認來源授權。

`site/data/portal.json` 對每個來源分別保留 status、attemptedAt、checkedAt 和 data。成功時間在完成抓取與驗證後寫入；來源失敗保留上次資料與成功時間，標記 error。generatedAt 只是整份檔案產出時間，不代表所有來源成功。超過 90 分鐘、未來／無效時間或來源 error 均顯示待確認。預報期間過期後不再當成目前預報展示。新聞保留來源發稿時間，不以抓取時間冒充。

### 自動更新與補救

主流程先嘗試颱風更新，再獨立抓取縣市預報及三個 RSS。颱風失敗不阻擋其他來源發布；歷史原檔不變，前台依 archive checkedAt 警告。縣市或 RSS 失敗亦不拖垮其餘來源。發布前驗證值域、22 縣市覆蓋、RSS 結構、連結網域與憑證；raw response、原始錯誤訊息、CWA_API_KEY 都不輸出到網站。

補救流程同時檢查 repository 與公開 Pages 的 archive、portal 更新時間。portal generatedAt 用來檢查發佈管線是否執行；各來源成功與否以 sources 為準。GitHub 兩個排程仍不是獨立排程服務，不能保證不延遲或漏觸發。

### 驗證與後續

`node --test` 包含 22 縣市完整性／值域、過期預報、來源失敗隔離、RSS 不安全連結、未來發稿、新聞篩選、無活動颱風保留歷史，以及 repo／Pages 補救測試。測試資料只留在 tests，不發布為氣象資訊。

本次不使用未經來源驗證的風場、雷達或雲系動畫；不把停班課參考值轉成放假判定。空氣品質、逐站雨量、各縣市政府新聞與更細的鄉鎮預報，可於後續加入，須各自設計來源時間和失敗狀態。
