# 颱風路徑瀏覽器：GitHub Pages 自動更新版

以咖哩東＆氣象象的 MIT 授權 v0.69 改作，保留地圖、暴風圈、70% 機率範圍、強度圖表、歷次預報比較，以及 JSON 載入／下載。

## 運作方式

GitHub Actions 預計每 15 分鐘（UTC 每小時第 11、26、41、56 分）向中央氣象署 W-C0034-005 檢查資料，合併同一颱風的歷次預報，再發布 `site/` 到 GitHub Pages。每次成功抓取（包含預報未變）都發布實際檢查時間。另有每 30 分鐘的過期檢查；超過 45 分鐘未成功抓取且沒有更新工作排隊或執行時，會補觸發主流程。網頁每 10 分鐘重讀網站 JSON。關閉電腦和瀏覽器後仍可更新。實際 GitHub 排程可能延遲或漏跑。

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
