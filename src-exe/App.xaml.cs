using System.Collections.Generic;
using System.Windows;

namespace RustFix
{
    public partial class App : Application
    {
        /// <summary>Привилегии, включённые при старте (режим суперпользователя).</summary>
        public static List<string> EnabledPrivileges { get; private set; } = new();

        protected override void OnStartup(StartupEventArgs e)
        {
            // 1. Требуем права администратора. Манифест объявляет requireAdministrator,
            //    но если приложение запустили в обход манифеста — перезапускаемся сами.
            if (!Privileges.IsElevated)
            {
                if (Privileges.RestartElevated())
                {
                    Shutdown();
                    return;
                }

                MessageBox.Show(
                    "RustFix требует прав администратора: без них Windows не разрешает снятие обновлений.",
                    "RustFix by YAWASIDE x TRIAGED", MessageBoxButton.OK, MessageBoxImage.Warning);
                Shutdown();
                return;
            }

            // 2. Включаем привилегии, которых нет у обычного администратора.
            //    Без них DISM/wusa не могут снять KB, защищённые хранилищем компонентов.
            EnabledPrivileges = Privileges.EnableAll();

            base.OnStartup(e);
        }
    }
}
