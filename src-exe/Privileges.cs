using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Security.Principal;
using System.Text;

namespace RustFix
{
    /// <summary>
    /// Режим суперпользователя.
    /// 1) Приложение объявляет requireAdministrator в манифесте и, если его всё же
    ///    запустили без прав, повышает себя само (UAC).
    /// 2) Внутри процесса включаются привилегии, которых нет у обычного админа:
    ///    SeTakeOwnership, SeBackup, SeRestore, SeDebug, SeSecurity — без них
    ///    удаление KB, защищённых службой обслуживания Windows, невозможно.
    /// </summary>
    internal static class Privileges
    {
        private const uint TOKEN_ADJUST_PRIVILEGES = 0x0020;
        private const uint TOKEN_QUERY = 0x0008;
        private const uint SE_PRIVILEGE_ENABLED = 0x0002;

        [StructLayout(LayoutKind.Sequential)]
        private struct LUID
        {
            public uint LowPart;
            public int HighPart;
        }

        [StructLayout(LayoutKind.Sequential)]
        private struct TOKEN_PRIVILEGES
        {
            public uint PrivilegeCount;
            public LUID Luid;
            public uint Attributes;
        }

        [DllImport("advapi32.dll", SetLastError = true)]
        private static extern bool OpenProcessToken(IntPtr processHandle, uint desiredAccess, out IntPtr tokenHandle);

        [DllImport("advapi32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
        private static extern bool LookupPrivilegeValue(string? systemName, string name, out LUID luid);

        [DllImport("advapi32.dll", SetLastError = true)]
        private static extern bool AdjustTokenPrivileges(IntPtr tokenHandle, bool disableAllPrivileges,
            ref TOKEN_PRIVILEGES newState, uint bufferLength, IntPtr previousState, IntPtr returnLength);

        [DllImport("kernel32.dll")]
        private static extern IntPtr GetCurrentProcess();

        [DllImport("kernel32.dll", SetLastError = true)]
        private static extern bool CloseHandle(IntPtr handle);

        /// <summary>Имена привилегий, которые переводят сеанс в режим суперпользователя.</summary>
        private static readonly string[] Wanted =
        {
            "SeTakeOwnershipPrivilege",
            "SeBackupPrivilege",
            "SeRestorePrivilege",
            "SeDebugPrivilege",
            "SeSecurityPrivilege",
            "SeLoadDriverPrivilege",
            "SeShutdownPrivilege"
        };

        public static bool IsElevated
        {
            get
            {
                try
                {
                    using var identity = WindowsIdentity.GetCurrent();
                    var principal = new WindowsPrincipal(identity);
                    return principal.IsInRole(WindowsBuiltInRole.Administrator);
                }
                catch
                {
                    return false;
                }
            }
        }

        /// <summary>Перезапускает приложение с правами администратора через запрос UAC.</summary>
        public static bool RestartElevated()
        {
            try
            {
                string? exe = Environment.ProcessPath;
                if (string.IsNullOrWhiteSpace(exe)) return false;

                var info = new ProcessStartInfo(exe)
                {
                    UseShellExecute = true,
                    Verb = "runas",
                    WorkingDirectory = AppContext.BaseDirectory
                };
                Process.Start(info);
                return true;
            }
            catch
            {
                return false;
            }
        }

        /// <summary>Включает привилегии и возвращает список тех, что реально активированы.</summary>
        public static List<string> EnableAll()
        {
            var enabled = new List<string>();

            if (!OpenProcessToken(GetCurrentProcess(), TOKEN_ADJUST_PRIVILEGES | TOKEN_QUERY, out IntPtr token) || token == IntPtr.Zero)
                return enabled;

            try
            {
                foreach (string name in Wanted)
                {
                    if (!LookupPrivilegeValue(null, name, out LUID luid)) continue;

                    var state = new TOKEN_PRIVILEGES
                    {
                        PrivilegeCount = 1,
                        Luid = luid,
                        Attributes = SE_PRIVILEGE_ENABLED
                    };

                    if (AdjustTokenPrivileges(token, false, ref state, 0, IntPtr.Zero, IntPtr.Zero))
                        enabled.Add(name.Replace("Privilege", string.Empty));
                }
            }
            finally
            {
                CloseHandle(token);
            }

            return enabled;
        }

        public static string Describe(List<string> enabled)
        {
            var sb = new StringBuilder();
            sb.Append(IsElevated ? "администратор" : "НЕТ ПРАВ АДМИНИСТРАТОРА");
            if (enabled.Count > 0)
                sb.Append(" · ").Append(string.Join(", ", enabled));
            sb.Append(" · владение файлами служб обслуживания");
            return sb.ToString();
        }
    }
}
