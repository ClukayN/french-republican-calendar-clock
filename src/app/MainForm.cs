using System;
using System.Drawing;
using System.IO;
using System.Reflection;
using System.Threading.Tasks;
using System.Windows.Forms;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

namespace RepublicanCalendar
{
    public class MainForm : Form
    {
        private readonly string wwwDir;
        private readonly string userDataDir;
        private readonly WebView2 view;
        private Panel fallback;
        private readonly string boundsFile;
        private readonly float uiScale;

        public MainForm(string wwwDir, string userDataDir)
        {
            this.wwwDir = wwwDir;
            this.userDataDir = userDataDir;
            this.boundsFile = Path.Combine(userDataDir, "window.txt");

            AutoScaleMode = AutoScaleMode.None;   /* 尺寸一律按物理像素自己算 */
            uiScale = ResolveScale();

            Text = "法国共和历 · Calendrier républicain";
            BackColor = Color.FromArgb(243, 234, 216);
            StartPosition = FormStartPosition.CenterScreen;
            ClientSize = InitialClientSize();
            MinimumSize = Dip(880, 560);
            DoubleBuffered = true;
            KeyPreview = true;

            TryLoadIcon();

            view = new WebView2();
            view.Dock = DockStyle.Fill;
            view.DefaultBackgroundColor = Color.FromArgb(243, 234, 216);
            view.AllowExternalDrop = false;
            Controls.Add(view);

            RestoreWindowBounds();

            Load += OnLoad;
            FormClosing += OnClosing;
        }

        private float ResolveScale()
        {
            try
            {
                using (Graphics g = CreateGraphics())
                {
                    float s = g.DpiX / 96f;
                    if (s < 1f) return 1f;
                    if (s > 4f) return 4f;
                    return s;
                }
            }
            catch (Exception) { return 1f; }
        }

        /* 设计稿为 1180×800 个 CSS 像素（等于 96dpi 下的 DIP） */
        private Size Dip(int w, int h)
        {
            return new Size(
                (int)Math.Round(w * uiScale, MidpointRounding.AwayFromZero),
                (int)Math.Round(h * uiScale, MidpointRounding.AwayFromZero));
        }

        private Size InitialClientSize()
        {
            Size want = Dip(1180, 800);
            Rectangle wa = Screen.PrimaryScreen.WorkingArea;
            int maxW = (int)Math.Round(wa.Width * 0.94, MidpointRounding.AwayFromZero);
            int maxH = (int)Math.Round(wa.Height * 0.94, MidpointRounding.AwayFromZero);
            if (want.Width > maxW) want.Width = maxW;
            if (want.Height > maxH) want.Height = maxH;
            return want;
        }

        protected override void OnShown(EventArgs e)
        {
            base.OnShown(e);
            ClampToScreen();
        }

        /* 保证窗口完整落在工作区内（高分屏下按 DIP 放大后可能超出） */
        private void ClampToScreen()
        {
            try
            {
                Rectangle wa = Screen.FromControl(this).WorkingArea;
                Rectangle b = Bounds;
                if (b.Width > wa.Width) b.Width = wa.Width;
                if (b.Height > wa.Height) b.Height = wa.Height;
                if (b.Right > wa.Right) b.X = wa.Right - b.Width;
                if (b.Bottom > wa.Bottom) b.Y = wa.Bottom - b.Height;
                if (b.X < wa.Left) b.X = wa.Left;
                if (b.Y < wa.Top) b.Y = wa.Top;
                if (b != Bounds) Bounds = b;
            }
            catch (Exception) { }
        }

        private void TryLoadIcon()
        {
            try
            {
                string ico = Path.Combine(userDataDir, "app.ico");
                if (File.Exists(ico)) Icon = new Icon(ico);
            }
            catch (Exception) { /* 图标非关键 */ }
        }

        private void RestoreWindowBounds()
        {
            try
            {
                if (!File.Exists(boundsFile)) return;
                string[] parts = File.ReadAllText(boundsFile).Split(',');
                if (parts.Length < 4) return;
                Rectangle wa = Screen.PrimaryScreen.WorkingArea;
                Rectangle r = new Rectangle(
                    int.Parse(parts[0]), int.Parse(parts[1]),
                    int.Parse(parts[2]), int.Parse(parts[3]));
                if (r.Width < MinimumSize.Width || r.Height < MinimumSize.Height) return;
                /* 只接受与当前屏幕仍相交的位置 */
                if (!wa.IntersectsWith(r)) return;
                StartPosition = FormStartPosition.Manual;
                Bounds = r;
            }
            catch (Exception) { /* 忽略损坏的配置 */ }
        }

        private void SaveBounds()
        {
            try
            {
                Rectangle r = WindowState == FormWindowState.Normal ? Bounds : RestoreBounds;
                File.WriteAllText(boundsFile,
                    r.X + "," + r.Y + "," + r.Width + "," + r.Height);
            }
            catch (Exception) { /* 忽略 */ }
        }

        private async void OnLoad(object sender, EventArgs e)
        {
            try
            {
                CoreWebView2Environment env = await CoreWebView2Environment
                    .CreateAsync(null, userDataDir, null);
                await view.EnsureCoreWebView2Async(env);

                CoreWebView2 core = view.CoreWebView2;
                core.Settings.AreDefaultContextMenusEnabled = false;
                core.Settings.IsStatusBarEnabled = false;
                core.Settings.AreDevToolsEnabled = true;
                core.Settings.IsZoomControlEnabled = true;
                core.Settings.IsPinchZoomEnabled = false;
                core.Settings.AreBrowserAcceleratorKeysEnabled = false;

                core.SetVirtualHostNameToFolderMapping(
                    "calendar.local", wwwDir, CoreWebView2HostResourceAccessKind.Allow);

                core.Navigate("https://calendar.local/index.html");
            }
            catch (Exception ex)
            {
                ShowFallback(ex);
            }
        }

        private void ShowFallback(Exception ex)
        {
            view.Visible = false;

            fallback = new Panel();
            fallback.Dock = DockStyle.Fill;
            fallback.BackColor = Color.FromArgb(243, 234, 216);

            TableLayoutPanel grid = new TableLayoutPanel();
            grid.Dock = DockStyle.Fill;
            grid.ColumnCount = 1;
            grid.RowCount = 5;
            grid.Padding = new Padding(48, 96, 48, 48);
            grid.RowStyles.Add(new RowStyle(SizeType.AutoSize));
            grid.RowStyles.Add(new RowStyle(SizeType.AutoSize));
            grid.RowStyles.Add(new RowStyle(SizeType.AutoSize));
            grid.RowStyles.Add(new RowStyle(SizeType.AutoSize));
            grid.RowStyles.Add(new RowStyle(SizeType.Percent, 100));

            Label title = new Label();
            title.Text = "无法启动界面";
            title.Font = new Font("Microsoft YaHei UI", 20F, FontStyle.Bold);
            title.AutoSize = true;
            title.Margin = new Padding(0, 0, 0, 16);

            Label body = new Label();
            body.Text = "本程序需要 Microsoft Edge WebView2 运行时。\r\n" +
                        "请安装后重新打开，或检查系统是否已禁用 WebView2。\r\n\r\n" +
                        "详细信息：" + ex.Message;
            body.Font = new Font("Microsoft YaHei UI", 10.5F);
            body.AutoSize = true;
            body.MaximumSize = new Size(760, 0);

            LinkLabel link = new LinkLabel();
            link.Text = "下载 WebView2 运行时";
            link.Font = new Font("Microsoft YaHei UI", 10.5F);
            link.AutoSize = true;
            link.LinkClicked += delegate
            {
                try
                {
                    System.Diagnostics.Process.Start(
                        "https://go.microsoft.com/fwlink/p/?LinkId=2124703");
                }
                catch (Exception) { }
            };

            grid.Controls.Add(title, 0, 0);
            grid.Controls.Add(body, 0, 1);
            grid.Controls.Add(link, 0, 2);
            fallback.Controls.Add(grid);
            Controls.Add(fallback);
            fallback.BringToFront();
        }

        private void OnClosing(object sender, FormClosingEventArgs e)
        {
            SaveBounds();
            try { view.Dispose(); }
            catch (Exception) { }
        }
    }
}
