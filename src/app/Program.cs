using System;
using System.Drawing;
using System.IO;
using System.Reflection;
using System.Runtime.CompilerServices;
using System.Runtime.InteropServices;
using System.Windows.Forms;

namespace RepublicanCalendar
{
    internal static class Program
    {
        [STAThread]
        private static void Main()
        {
            /* 必须最先注册：WebView2 的托管程序集以资源形式内嵌，运行时按需装回 */
            Bootstrap.HookAssemblyResolver();

            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            Run();
        }

        /* 单独一层且禁止内联：让 Main 的 JIT 不去解析 MainForm 里出现的 WebView2 类型 */
        [MethodImpl(MethodImplOptions.NoInlining)]
        private static void Run()
        {
            string wwwDir;
            string userDataDir;
            try
            {
                wwwDir = Bootstrap.Prepare();
                userDataDir = Bootstrap.UserDataDir();
            }
            catch (Exception ex)
            {
                MessageBox.Show(
                    "无法解压程序资源：\r\n" + ex.Message,
                    "法国共和历",
                    MessageBoxButtons.OK, MessageBoxIcon.Error);
                return;
            }

            Application.Run(new MainForm(wwwDir, userDataDir));
        }
    }

    /// <summary>
    /// 把内嵌资源释放到 %LOCALAPPDATA%\RepublicanCalendar\app，
    /// 并把该目录加入 DLL 搜索路径，供 WebView2Loader.dll 加载。
    /// </summary>
    internal static class Bootstrap
    {
        private const string HostName = "calendar.local";

        internal static string UserDataDir()
        {
            string dir = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                "RepublicanCalendar");
            Directory.CreateDirectory(dir);
            return dir;
        }

        /* ---------------------------------------------------------------
         * WebView2 的两个托管程序集以资源内嵌，CLR 找不到时从这里装回去。
         * ------------------------------------------------------------- */
        internal static void HookAssemblyResolver()
        {
            AppDomain.CurrentDomain.AssemblyResolve += ResolveAssembly;
        }

        [MethodImpl(MethodImplOptions.NoInlining)]
        private static Assembly ResolveAssembly(object sender, ResolveEventArgs args)
        {
            try
            {
                AssemblyName an = new AssemblyName(args.Name);
                string simple = an.Name;
                if (string.IsNullOrEmpty(simple)) return null;

                Assembly self = Assembly.GetExecutingAssembly();
                using (Stream s = self.GetManifestResourceStream("lib." + simple + ".dll"))
                {
                    if (s != null) return Assembly.Load(ReadAll(s));
                }

                string[] probes = new string[]
                {
                    Path.Combine(AppDomain.CurrentDomain.BaseDirectory, simple + ".dll"),
                    Path.Combine(UserDataDir(), "app", simple + ".dll")
                };
                for (int i = 0; i < probes.Length; i++)
                {
                    if (File.Exists(probes[i])) return Assembly.LoadFrom(probes[i]);
                }
            }
            catch (Exception)
            {
                /* 交给默认探测逻辑 */
            }
            return null;
        }

        internal static string Prepare()
        {
            string root = UserDataDir();
            string www = Path.Combine(root, "app");
            Directory.CreateDirectory(www);

            Extract("www.index.html", Path.Combine(www, "index.html"));
            Extract("www.app.js", Path.Combine(www, "app.js"));
            Extract("www.calendar.js", Path.Combine(www, "calendar.js"));
            Extract("www.styles.css", Path.Combine(www, "styles.css"));
            Extract("www.data.js", Path.Combine(www, "data.js"));
            Extract("lib.WebView2Loader.dll", Path.Combine(www, "WebView2Loader.dll"));
            ExtractIfPresent("res.app.ico", Path.Combine(root, "app.ico"));

            /* 让 WebView2Loader.dll 能被隐式链接到 */
            SetDllDirectory(www);
            return www;
        }

        private static void Extract(string resourceName, string targetPath)
        {
            Assembly asm = Assembly.GetExecutingAssembly();
            using (Stream src = asm.GetManifestResourceStream(resourceName))
            {
                if (src == null)
                    throw new InvalidOperationException("缺少内嵌资源：" + resourceName);

                byte[] data = ReadAll(src);
                if (File.Exists(targetPath))
                {
                    byte[] old = File.ReadAllBytes(targetPath);
                    if (old.Length == data.Length && BytesEqual(old, data))
                        return;
                }
                File.WriteAllBytes(targetPath, data);
            }
        }

        private static void ExtractIfPresent(string resourceName, string targetPath)
        {
            Assembly asm = Assembly.GetExecutingAssembly();
            if (asm.GetManifestResourceInfo(resourceName) == null) return;
            try { Extract(resourceName, targetPath); }
            catch (Exception) { /* 图标非关键 */ }
        }

        internal static byte[] ReadAll(Stream s)
        {
            using (MemoryStream ms = new MemoryStream())
            {
                byte[] buf = new byte[81920];
                int n;
                while ((n = s.Read(buf, 0, buf.Length)) > 0) ms.Write(buf, 0, n);
                return ms.ToArray();
            }
        }

        private static bool BytesEqual(byte[] a, byte[] b)
        {
            if (a.Length != b.Length) return false;
            for (int i = 0; i < a.Length; i++) if (a[i] != b[i]) return false;
            return true;
        }

        [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
        private static extern bool SetDllDirectory(string lpPathName);
    }
}
