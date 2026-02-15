using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.IO;
using System.Linq;
using System.Media;
using System.Net.Http;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using System.Windows.Forms;

namespace LogiTrackLauncher
{
    public class MainForm : Form
    {
        // ── Couleurs du thème (clair, cohérent avec LogiTrack) ──
        private static readonly Color BgDark       = Color.FromArgb(243, 244, 246);  // gray-100
        private static readonly Color BgCard       = Color.White;
        private static readonly Color BgCardHover  = Color.FromArgb(249, 250, 251);  // gray-50
        private static readonly Color BorderCard   = Color.FromArgb(229, 231, 235);  // gray-200
        private static readonly Color TextPrimary  = Color.FromArgb(17, 24, 39);     // gray-900
        private static readonly Color TextSecondary = Color.FromArgb(107, 114, 128);  // gray-500
        private static readonly Color AccentBlue   = Color.FromArgb(59, 130, 246);   // blue-500
        private static readonly Color AccentGreen  = Color.FromArgb(34, 197, 94);    // green-500
        private static readonly Color AccentRed    = Color.FromArgb(239, 68, 68);    // red-500
        private static readonly Color AccentAmber  = Color.FromArgb(245, 158, 11);   // amber-500
        private static readonly Color AccentTeal   = Color.FromArgb(20, 184, 166);   // teal-500
        private static readonly Color AccentPurple = Color.FromArgb(139, 92, 246);   // violet-500
        private static readonly Color GradientStart = Color.FromArgb(59, 130, 246);  // blue-500
        private static readonly Color GradientEnd   = Color.FromArgb(99, 102, 241);  // indigo-500

        // ── Chemins ────────────────────────────────────────────
        private readonly string _basePath;
        private readonly string _backendPath;
        private readonly string _frontendPath;
        private readonly string _nodePath;
        private readonly string _mysqlPath;

        // ── Processus ──────────────────────────────────────────
        private Process? _backendProcess;
        private Process? _frontendProcess;
        private bool _backendRunning;
        private bool _frontendRunning;
        private bool _mysqlRunning;
        private readonly HttpClient _httpClient = new() { Timeout = TimeSpan.FromSeconds(3) };
        private System.Windows.Forms.Timer _healthTimer = null!;

        // ── Health info ────────────────────────────────────────
        private string _serverVersion = "—";
        private string _dbStatus = "unknown";
        private int _serverUptime = 0;

        // ── Contrôles UI ───────────────────────────────────────
        private Panel _headerPanel = null!;
        private Panel _cardsPanel = null!;
        private Panel _logPanel = null!;
        private RichTextBox _logBox = null!;
        private Panel _statusBar = null!;
        private Label _statusLabel = null!;
        private Label _versionLabel = null!;

        // Service cards
        private ServiceCard _mysqlCard = null!;
        private ServiceCard _backendCard = null!;
        private ServiceCard _frontendCard = null!;

        // Master buttons
        private ModernButton _btnStartAll = null!;
        private ModernButton _btnStopAll = null!;
        private ModernButton _btnOpenBrowser = null!;
        private ModernButton _btnOpenFolder = null!;
        private ModernButton _btnClearLogs = null!;

        // System Tray
        private NotifyIcon? _trayIcon;
        private ContextMenuStrip? _trayMenu;

        public MainForm()
        {
            // Detect paths
            _basePath = FindLogiTrackRoot();
            _backendPath = Path.Combine(_basePath, "backend");
            _frontendPath = Path.Combine(_basePath, "frontend");
            _nodePath = FindNodePath();
            _mysqlPath = FindMysqlPath();

            InitializeComponent();
            SetupHealthCheck();
            SetupTrayIcon();
            LoadIcon();
            PlayStartupSound();
            UpdateMasterButtons();

            Log("LogiTrack Launcher v2.1.0 initialisé", LogLevel.Info);
            Log($"Dossier projet : {_basePath}", LogLevel.Info);
            Log($"Node.js : {_nodePath}", LogLevel.Info);
            Log($"MySQL : {_mysqlPath}", LogLevel.Info);

            // Check MySQL on startup
            _ = CheckMySQLStatus();
        }

        // ════════════════════════════════════════════════════════
        //  UI SETUP
        // ════════════════════════════════════════════════════════
        private void InitializeComponent()
        {
            SuspendLayout();

            // ── Form settings ──
            Text = "LogiTrack Launcher v2.1.0";
            Size = new Size(920, 780);
            MinimumSize = new Size(800, 650);
            StartPosition = FormStartPosition.CenterScreen;
            BackColor = BgDark;
            ForeColor = TextPrimary;
            Font = new Font("Segoe UI", 10F, FontStyle.Regular);
            DoubleBuffered = true;
            FormBorderStyle = FormBorderStyle.Sizable;

            // ── Header with gradient ──
            _headerPanel = new Panel
            {
                Dock = DockStyle.Top,
                Height = 110,
                Padding = new Padding(30, 20, 30, 15)
            };
            _headerPanel.Paint += HeaderPanel_Paint;

            var logoLabel = new Label
            {
                Text = "⚙  LogiTrack",
                Font = new Font("Segoe UI", 24F, FontStyle.Bold),
                ForeColor = Color.White,
                AutoSize = true,
                Location = new Point(30, 18),
                BackColor = Color.Transparent
            };

            var subtitleLabel = new Label
            {
                Text = "ERP Production — Backend · Frontend · MySQL",
                Font = new Font("Segoe UI", 10F, FontStyle.Regular),
                ForeColor = Color.FromArgb(220, 230, 245),
                AutoSize = true,
                Location = new Point(33, 60),
                BackColor = Color.Transparent
            };

            _versionLabel = new Label
            {
                Text = "Launcher v2.1.0 — Serveur: en attente...",
                Font = new Font("Segoe UI", 9F, FontStyle.Regular),
                ForeColor = Color.FromArgb(160, 190, 230),
                AutoSize = true,
                Location = new Point(33, 82),
                BackColor = Color.Transparent
            };

            _headerPanel.Controls.AddRange(new Control[] { logoLabel, subtitleLabel, _versionLabel });

            // ── Cards panel ──
            _cardsPanel = new Panel
            {
                Dock = DockStyle.Top,
                Height = 260,
                Padding = new Padding(20, 10, 20, 10),
                BackColor = BgDark
            };

            // MySQL card
            _mysqlCard = new ServiceCard
            {
                ServiceName = "MySQL Database",
                ServiceDescription = "MySQL 8.0 — Port 3306",
                ServiceIcon = "🗄",
                AccentColor = AccentPurple,
                IsExternalService = true,
                Location = new Point(20, 10),
                Width = 270
            };
            _mysqlCard.StartClicked += (_, _) => StartMySQL();
            _mysqlCard.StopClicked += (_, _) => StopMySQL();

            // Backend card
            _backendCard = new ServiceCard
            {
                ServiceName = "Backend API",
                ServiceDescription = "Express.js — Port 3002",
                ServiceIcon = "🖥",
                AccentColor = AccentBlue,
                Location = new Point(300, 10),
                Width = 270
            };
            _backendCard.StartClicked += (_, _) => StartBackend();
            _backendCard.StopClicked += (_, _) => StopBackend();

            // Frontend card
            _frontendCard = new ServiceCard
            {
                ServiceName = "Frontend App",
                ServiceDescription = "Vite + React — Port 5173",
                ServiceIcon = "🌐",
                AccentColor = AccentTeal,
                Location = new Point(580, 10),
                Width = 270
            };
            _frontendCard.StartClicked += (_, _) => StartFrontend();
            _frontendCard.StopClicked += (_, _) => StopFrontend();

            _cardsPanel.Controls.AddRange(new Control[] { _mysqlCard, _backendCard, _frontendCard });

            // ── Master buttons panel ──
            var buttonsPanel = new Panel
            {
                Dock = DockStyle.Top,
                Height = 60,
                Padding = new Padding(20, 5, 20, 5),
                BackColor = BgDark
            };

            _btnStartAll = new ModernButton
            {
                Text = "▶  Tout Démarrer",
                GradientStart = AccentGreen,
                GradientEnd = Color.FromArgb(35, 134, 54),
                Location = new Point(20, 8),
                Size = new Size(160, 42)
            };
            _btnStartAll.Click += (_, _) => StartAll();

            _btnStopAll = new ModernButton
            {
                Text = "⏹  Tout Arrêter",
                GradientStart = AccentRed,
                GradientEnd = Color.FromArgb(180, 40, 38),
                Location = new Point(190, 8),
                Size = new Size(160, 42)
            };
            _btnStopAll.Click += (_, _) => StopAll();

            _btnOpenBrowser = new ModernButton
            {
                Text = "🔗  Navigateur",
                GradientStart = AccentBlue,
                GradientEnd = Color.FromArgb(40, 100, 210),
                Location = new Point(360, 8),
                Size = new Size(155, 42)
            };
            _btnOpenBrowser.Click += (_, _) => OpenBrowser();

            _btnOpenFolder = new ModernButton
            {
                Text = "📁  Dossier Projet",
                GradientStart = AccentPurple,
                GradientEnd = Color.FromArgb(109, 62, 216),
                Location = new Point(525, 8),
                Size = new Size(155, 42)
            };
            _btnOpenFolder.Click += (_, _) => OpenProjectFolder();

            _btnClearLogs = new ModernButton
            {
                Text = "🗑  Vider Logs",
                GradientStart = Color.FromArgb(107, 114, 128),
                GradientEnd = Color.FromArgb(75, 85, 99),
                Location = new Point(690, 8),
                Size = new Size(145, 42)
            };
            _btnClearLogs.Click += (_, _) => ClearLogs();

            buttonsPanel.Controls.AddRange(new Control[] { _btnStartAll, _btnStopAll, _btnOpenBrowser, _btnOpenFolder, _btnClearLogs });

            // ── Log section ──
            var logHeader = new Panel
            {
                Dock = DockStyle.Top,
                Height = 35,
                BackColor = BgDark,
                Padding = new Padding(25, 8, 25, 0)
            };
            var logTitle = new Label
            {
                Text = "📋  Journal d'activité",
                Font = new Font("Segoe UI", 11F, FontStyle.Bold),
                ForeColor = TextSecondary,
                AutoSize = true,
                Location = new Point(25, 8)
            };
            logHeader.Controls.Add(logTitle);

            _logPanel = new Panel
            {
                Dock = DockStyle.Fill,
                Padding = new Padding(25, 5, 25, 10),
                BackColor = BgDark
            };

            _logBox = new RichTextBox
            {
                Dock = DockStyle.Fill,
                BackColor = Color.FromArgb(249, 250, 251),
                ForeColor = TextSecondary,
                BorderStyle = BorderStyle.None,
                ReadOnly = true,
                WordWrap = true,
                ScrollBars = RichTextBoxScrollBars.Vertical
            };

            // Try better font
            if (IsFontInstalled("Cascadia Code"))
                _logBox.Font = new Font("Cascadia Code", 9F);
            else
                _logBox.Font = new Font("Consolas", 9F);

            _logPanel.Controls.Add(_logBox);

            // ── Status bar ──
            _statusBar = new Panel
            {
                Dock = DockStyle.Bottom,
                Height = 32,
                BackColor = Color.White,
                Padding = new Padding(15, 0, 15, 0)
            };
            _statusBar.Paint += (s, e) =>
            {
                using var pen = new Pen(BorderCard);
                e.Graphics.DrawLine(pen, 0, 0, _statusBar.Width, 0);
            };

            _statusLabel = new Label
            {
                Text = "Prêt",
                ForeColor = TextSecondary,
                Font = new Font("Segoe UI", 8.5F),
                Dock = DockStyle.Left,
                AutoSize = true,
                TextAlign = ContentAlignment.MiddleLeft,
                Padding = new Padding(0, 6, 0, 0)
            };

            var creditLabel = new Label
            {
                Text = "Coded with ❤️ by Azizi Mounir – Février 2026",
                ForeColor = TextSecondary,
                Font = new Font("Segoe UI", 8F),
                Dock = DockStyle.Right,
                AutoSize = true,
                TextAlign = ContentAlignment.MiddleRight,
                Padding = new Padding(0, 7, 0, 0)
            };

            _statusBar.Controls.Add(_statusLabel);
            _statusBar.Controls.Add(creditLabel);

            // ── Assembly ──
            Controls.Add(_logPanel);
            Controls.Add(logHeader);
            Controls.Add(buttonsPanel);
            Controls.Add(_cardsPanel);
            Controls.Add(_headerPanel);
            Controls.Add(_statusBar);

            // ── Resize handler ──
            Resize += (_, _) => LayoutCards();

            ResumeLayout(true);
            LayoutCards();
        }

        private void LayoutCards()
        {
            int availW = _cardsPanel.ClientSize.Width - 40; // 20px padding each side
            int gap = 12;
            int cardW = (availW - gap * 2) / 3;
            if (cardW < 180) cardW = 180;

            _mysqlCard.SetBounds(20, 10, cardW, 230);
            _backendCard.SetBounds(20 + cardW + gap, 10, cardW, 230);
            _frontendCard.SetBounds(20 + (cardW + gap) * 2, 10, cardW, 230);
        }

        private void HeaderPanel_Paint(object? sender, PaintEventArgs e)
        {
            var rect = _headerPanel.ClientRectangle;
            using var brush = new LinearGradientBrush(rect, 
                Color.FromArgb(30, 58, 138), Color.FromArgb(67, 56, 202),
                LinearGradientMode.Horizontal);
            e.Graphics.FillRectangle(brush, rect);

            // Bottom accent line
            using var accentBrush = new LinearGradientBrush(
                new Rectangle(0, rect.Height - 3, rect.Width, 3),
                GradientStart, GradientEnd, LinearGradientMode.Horizontal);
            e.Graphics.FillRectangle(accentBrush, 0, rect.Height - 3, rect.Width, 3);
        }

        // ════════════════════════════════════════════════════════
        //  SYSTEM TRAY
        // ════════════════════════════════════════════════════════
        private void SetupTrayIcon()
        {
            _trayMenu = new ContextMenuStrip();
            _trayMenu.Items.Add("Afficher", null, (_, _) => { Show(); WindowState = FormWindowState.Normal; BringToFront(); });
            _trayMenu.Items.Add("-");
            _trayMenu.Items.Add("▶ Tout Démarrer", null, (_, _) => StartAll());
            _trayMenu.Items.Add("⏹ Tout Arrêter", null, (_, _) => StopAll());
            _trayMenu.Items.Add("-");
            _trayMenu.Items.Add("Quitter", null, (_, _) => { _trayIcon!.Visible = false; Application.Exit(); });

            _trayIcon = new NotifyIcon
            {
                Text = "LogiTrack Launcher v2.1.0",
                ContextMenuStrip = _trayMenu,
                Visible = false
            };

            // Load icon
            try
            {
                var iconPath = Path.Combine(_basePath, "assets", "icon.ico");
                if (File.Exists(iconPath))
                    _trayIcon.Icon = new Icon(iconPath);
                else
                    _trayIcon.Icon = SystemIcons.Application;
            }
            catch
            {
                _trayIcon.Icon = SystemIcons.Application;
            }

            _trayIcon.DoubleClick += (_, _) =>
            {
                Show();
                WindowState = FormWindowState.Normal;
                BringToFront();
            };
        }

        // ════════════════════════════════════════════════════════
        //  MYSQL MANAGEMENT
        // ════════════════════════════════════════════════════════
        private async Task CheckMySQLStatus()
        {
            _mysqlCard.SetStatus(ServiceStatus.Starting);
            _mysqlCard.SetExtraInfo("Vérification...");
            
            bool running = await Task.Run(() => IsMySQLRunning());
            _mysqlRunning = running;

            if (running)
            {
                _mysqlCard.SetStatus(ServiceStatus.Running);
                _mysqlCard.SetExtraInfo("Connecté — Port 3306");
                Log("✓ MySQL détecté et actif", LogLevel.Success);
            }
            else
            {
                _mysqlCard.SetStatus(ServiceStatus.Stopped);
                _mysqlCard.SetExtraInfo("Non détecté");
                Log("⚠ MySQL non détecté — Démarrez Laragon ou MySQL manuellement", LogLevel.Warning);
            }

            UpdateGlobalStatus();
        }

        private bool IsMySQLRunning()
        {
            try
            {
                // Check if MySQL process is running
                var processes = Process.GetProcessesByName("mysqld");
                if (processes.Length > 0) return true;

                // Try connecting
                var proc = new Process
                {
                    StartInfo = new ProcessStartInfo
                    {
                        FileName = _mysqlPath,
                        Arguments = "-u root -e \"SELECT 1;\"",
                        UseShellExecute = false,
                        CreateNoWindow = true,
                        RedirectStandardOutput = true,
                        RedirectStandardError = true
                    }
                };
                proc.Start();
                proc.WaitForExit(5000);
                return proc.ExitCode == 0;
            }
            catch
            {
                return false;
            }
        }

        private void StartMySQL()
        {
            Log("Tentative de démarrage MySQL via Laragon...", LogLevel.Info);
            _mysqlCard.SetStatus(ServiceStatus.Starting);

            try
            {
                // Try starting via Laragon
                var laragonPath = @"C:\laragon\laragon.exe";
                if (File.Exists(laragonPath))
                {
                    Process.Start(new ProcessStartInfo
                    {
                        FileName = laragonPath,
                        Arguments = "start mysql",
                        UseShellExecute = true,
                        CreateNoWindow = true
                    });
                    Log("Demande de démarrage envoyée à Laragon", LogLevel.Info);
                }
                else
                {
                    // Try starting mysqld directly
                    var mysqldPath = Path.Combine(Path.GetDirectoryName(_mysqlPath) ?? "", "mysqld.exe");
                    if (File.Exists(mysqldPath))
                    {
                        Process.Start(new ProcessStartInfo
                        {
                            FileName = mysqldPath,
                            Arguments = "--defaults-file=\"C:\\laragon\\bin\\mysql\\mysql-8.0.30-winx64\\my.ini\"",
                            UseShellExecute = false,
                            CreateNoWindow = true
                        });
                        Log("MySQL démarré directement", LogLevel.Info);
                    }
                    else
                    {
                        Log("Impossible de trouver Laragon ou mysqld pour démarrer MySQL", LogLevel.Error);
                        _mysqlCard.SetStatus(ServiceStatus.Error);
                        return;
                    }
                }

                // Wait and re-check
                _ = Task.Run(async () =>
                {
                    await Task.Delay(5000);
                    BeginInvoke(() => _ = CheckMySQLStatus());
                });
            }
            catch (Exception ex)
            {
                _mysqlCard.SetStatus(ServiceStatus.Error);
                Log($"✗ Erreur démarrage MySQL: {ex.Message}", LogLevel.Error);
            }
        }

        private void StopMySQL()
        {
            Log("⚠ MySQL est un service externe. Utilisez Laragon pour l'arrêter.", LogLevel.Warning);
        }

        // ════════════════════════════════════════════════════════
        //  PROCESS MANAGEMENT
        // ════════════════════════════════════════════════════════
        private async void StartBackend()
        {
            if (_backendRunning)
            {
                Log("Backend déjà en cours d'exécution", LogLevel.Warning);
                return;
            }

            // Pre-flight: check MySQL
            if (!_mysqlRunning)
            {
                bool mysqlOk = await Task.Run(() => IsMySQLRunning());
                if (!mysqlOk)
                {
                    Log("⚠ MySQL n'est pas démarré ! Le Backend nécessite MySQL.", LogLevel.Error);
                    _backendCard.SetStatus(ServiceStatus.Error);
                    _backendCard.SetExtraInfo("MySQL requis !");
                    var result = MessageBox.Show(
                        "MySQL n'est pas démarré.\nLe Backend nécessite MySQL pour fonctionner.\n\nDémarrer quand même ?",
                        "LogiTrack — MySQL requis",
                        MessageBoxButtons.YesNo,
                        MessageBoxIcon.Warning);
                    if (result == DialogResult.No) return;
                }
                else
                {
                    _mysqlRunning = true;
                    _mysqlCard.SetStatus(ServiceStatus.Running);
                    _mysqlCard.SetExtraInfo("Connecté — Port 3306");
                }
            }

            _backendCard.SetStatus(ServiceStatus.Starting);
            _backendCard.SetExtraInfo("Démarrage en cours...");
            Log("Démarrage du Backend...", LogLevel.Info);
            SetStatus("Démarrage du Backend...");

            try
            {
                _backendProcess = new Process
                {
                    StartInfo = new ProcessStartInfo
                    {
                        FileName = _nodePath,
                        Arguments = "src/server.js",
                        WorkingDirectory = _backendPath,
                        UseShellExecute = false,
                        CreateNoWindow = true,
                        RedirectStandardOutput = true,
                        RedirectStandardError = true,
                        EnvironmentVariables = { ["NODE_ENV"] = "development" }
                    },
                    EnableRaisingEvents = true
                };

                _backendProcess.OutputDataReceived += (_, args) =>
                {
                    if (!string.IsNullOrEmpty(args.Data))
                        BeginInvoke(() => Log($"[Backend] {args.Data}", LogLevel.Output));
                };
                _backendProcess.ErrorDataReceived += (_, args) =>
                {
                    if (!string.IsNullOrEmpty(args.Data))
                        BeginInvoke(() => Log($"[Backend] {args.Data}", LogLevel.Output));
                };
                _backendProcess.Exited += (_, _) =>
                {
                    BeginInvoke(() =>
                    {
                        _backendRunning = false;
                        _backendCard.SetStatus(ServiceStatus.Stopped);
                        _backendCard.SetExtraInfo("");
                        Log("Backend arrêté", LogLevel.Warning);
                        UpdateHeaderVersion();
                        UpdateGlobalStatus();
                    });
                };

                _backendProcess.Start();
                _backendProcess.BeginOutputReadLine();
                _backendProcess.BeginErrorReadLine();

                // Wait for health check
                bool healthy = false;
                for (int i = 0; i < 15; i++)
                {
                    await Task.Delay(1000);
                    try
                    {
                        var resp = await _httpClient.GetAsync("http://localhost:3002/api/health");
                        if (resp.IsSuccessStatusCode)
                        {
                            // Parse enriched health response
                            var json = await resp.Content.ReadAsStringAsync();
                            ParseHealthResponse(json);
                            healthy = true;
                            break;
                        }
                    }
                    catch { }
                }

                if (healthy)
                {
                    _backendRunning = true;
                    _backendCard.SetStatus(ServiceStatus.Running);
                    _backendCard.SetExtraInfo($"v{_serverVersion} — DB: {_dbStatus}");
                    Log($"✓ Backend démarré — v{_serverVersion} — DB: {_dbStatus}", LogLevel.Success);
                    UpdateHeaderVersion();
                }
                else
                {
                    _backendCard.SetStatus(ServiceStatus.Error);
                    _backendCard.SetExtraInfo("Health check échoué");
                    Log("✗ Le Backend n'a pas répondu au health check", LogLevel.Error);
                }
            }
            catch (Exception ex)
            {
                _backendCard.SetStatus(ServiceStatus.Error);
                _backendCard.SetExtraInfo($"Erreur: {ex.Message}");
                Log($"✗ Erreur démarrage Backend: {ex.Message}", LogLevel.Error);
            }

            UpdateGlobalStatus();
        }

        private async void StartFrontend()
        {
            if (_frontendRunning)
            {
                Log("Frontend déjà en cours d'exécution", LogLevel.Warning);
                return;
            }

            _frontendCard.SetStatus(ServiceStatus.Starting);
            _frontendCard.SetExtraInfo("Démarrage Vite...");
            Log("Démarrage du Frontend...", LogLevel.Info);
            SetStatus("Démarrage du Frontend...");

            try
            {
                var npxPath = FindNpxPath();
                _frontendProcess = new Process
                {
                    StartInfo = new ProcessStartInfo
                    {
                        FileName = npxPath,
                        Arguments = "vite --host",
                        WorkingDirectory = _frontendPath,
                        UseShellExecute = false,
                        CreateNoWindow = true,
                        RedirectStandardOutput = true,
                        RedirectStandardError = true
                    },
                    EnableRaisingEvents = true
                };

                _frontendProcess.OutputDataReceived += (_, args) =>
                {
                    if (!string.IsNullOrEmpty(args.Data))
                    {
                        BeginInvoke(() => Log($"[Frontend] {args.Data}", LogLevel.Output));
                        if (args.Data.Contains("Local:") || args.Data.Contains("ready in"))
                        {
                            BeginInvoke(() =>
                            {
                                _frontendRunning = true;
                                _frontendCard.SetStatus(ServiceStatus.Running);
                                _frontendCard.SetExtraInfo("http://localhost:5173");
                                Log("✓ Frontend démarré avec succès sur le port 5173", LogLevel.Success);
                                UpdateGlobalStatus();
                                ShowTrayNotification("Services prêts", "Frontend et Backend sont opérationnels.");
                            });
                        }
                    }
                };
                _frontendProcess.ErrorDataReceived += (_, args) =>
                {
                    if (!string.IsNullOrEmpty(args.Data))
                        BeginInvoke(() => Log($"[Frontend] {args.Data}", LogLevel.Output));
                };
                _frontendProcess.Exited += (_, _) =>
                {
                    BeginInvoke(() =>
                    {
                        _frontendRunning = false;
                        _frontendCard.SetStatus(ServiceStatus.Stopped);
                        _frontendCard.SetExtraInfo("");
                        Log("Frontend arrêté", LogLevel.Warning);
                        UpdateGlobalStatus();
                    });
                };

                _frontendProcess.Start();
                _frontendProcess.BeginOutputReadLine();
                _frontendProcess.BeginErrorReadLine();

                // Timeout fallback
                _ = Task.Run(async () =>
                {
                    await Task.Delay(20000);
                    if (!_frontendRunning && _frontendProcess != null && !_frontendProcess.HasExited)
                    {
                        BeginInvoke(() =>
                        {
                            _frontendRunning = true;
                            _frontendCard.SetStatus(ServiceStatus.Running);
                            _frontendCard.SetExtraInfo("http://localhost:5173");
                            Log("✓ Frontend probablement démarré (timeout fallback)", LogLevel.Success);
                            UpdateGlobalStatus();
                        });
                    }
                });
            }
            catch (Exception ex)
            {
                _frontendCard.SetStatus(ServiceStatus.Error);
                _frontendCard.SetExtraInfo($"Erreur: {ex.Message}");
                Log($"✗ Erreur démarrage Frontend: {ex.Message}", LogLevel.Error);
            }
        }

        private void StopBackend()
        {
            if (!_backendRunning && _backendProcess == null) return;

            Log("Arrêt du Backend...", LogLevel.Info);
            SetStatus("Arrêt du Backend...");

            try
            {
                KillProcessTree(_backendProcess);
                _backendProcess = null;
                _backendRunning = false;
                _backendCard.SetStatus(ServiceStatus.Stopped);
                _backendCard.SetExtraInfo("");
                Log("✓ Backend arrêté", LogLevel.Success);
                UpdateHeaderVersion();
            }
            catch (Exception ex)
            {
                Log($"Erreur arrêt Backend: {ex.Message}", LogLevel.Error);
            }
            UpdateGlobalStatus();
        }

        private void StopFrontend()
        {
            if (!_frontendRunning && _frontendProcess == null) return;

            Log("Arrêt du Frontend...", LogLevel.Info);
            SetStatus("Arrêt du Frontend...");

            try
            {
                KillProcessTree(_frontendProcess);
                _frontendProcess = null;
                _frontendRunning = false;
                _frontendCard.SetStatus(ServiceStatus.Stopped);
                _frontendCard.SetExtraInfo("");
                Log("✓ Frontend arrêté", LogLevel.Success);
            }
            catch (Exception ex)
            {
                Log($"Erreur arrêt Frontend: {ex.Message}", LogLevel.Error);
            }
            UpdateGlobalStatus();
        }

        private async void StartAll()
        {
            Log("═══ Démarrage de tous les services ═══", LogLevel.Info);

            // 1. Check MySQL first
            await CheckMySQLStatus();

            // 2. Start Backend
            StartBackend();
            await Task.Delay(4000);

            // 3. Start Frontend
            StartFrontend();
        }

        private void StopAll()
        {
            Log("═══ Arrêt de tous les services ═══", LogLevel.Info);
            StopFrontend();
            StopBackend();
        }

        private void OpenBrowser()
        {
            string url = "http://localhost:5173";
            if (_frontendRunning)
            {
                Log($"Ouverture du navigateur : {url}", LogLevel.Info);
                Process.Start(new ProcessStartInfo(url) { UseShellExecute = true });
            }
            else if (_backendRunning)
            {
                url = "http://localhost:3002/api/health";
                Log($"Frontend non démarré. Ouverture API health : {url}", LogLevel.Warning);
                Process.Start(new ProcessStartInfo(url) { UseShellExecute = true });
            }
            else
            {
                Log("Aucun service n'est en cours d'exécution", LogLevel.Warning);
            }
        }

        private void OpenProjectFolder()
        {
            try
            {
                Process.Start(new ProcessStartInfo
                {
                    FileName = "explorer.exe",
                    Arguments = _basePath,
                    UseShellExecute = true
                });
                Log($"Dossier projet ouvert : {_basePath}", LogLevel.Info);
            }
            catch (Exception ex)
            {
                Log($"Erreur ouverture dossier: {ex.Message}", LogLevel.Error);
            }
        }

        // ════════════════════════════════════════════════════════
        //  HEALTH CHECK
        // ════════════════════════════════════════════════════════
        private void SetupHealthCheck()
        {
            _healthTimer = new System.Windows.Forms.Timer { Interval = 10000 };
            _healthTimer.Tick += async (_, _) =>
            {
                // Check Backend health
                if (_backendRunning)
                {
                    try
                    {
                        var resp = await _httpClient.GetAsync("http://localhost:3002/api/health");
                        if (resp.IsSuccessStatusCode)
                        {
                            var json = await resp.Content.ReadAsStringAsync();
                            ParseHealthResponse(json);
                            _backendCard.SetExtraInfo($"v{_serverVersion} — DB: {_dbStatus}");
                            _backendCard.UpdateUptime();

                            // Update MySQL status from health response
                            if (_dbStatus == "connected")
                            {
                                if (!_mysqlRunning)
                                {
                                    _mysqlRunning = true;
                                    _mysqlCard.SetStatus(ServiceStatus.Running);
                                }
                                _mysqlCard.SetExtraInfo("Connecté — Port 3306");
                            }
                            else
                            {
                                _mysqlCard.SetStatus(ServiceStatus.Error);
                                _mysqlCard.SetExtraInfo("Déconnecté !");
                                _backendCard.SetStatus(ServiceStatus.Error);
                                Log("⚠ Connexion MySQL perdue !", LogLevel.Error);
                            }

                            UpdateHeaderVersion();
                        }
                        else
                        {
                            _backendCard.SetStatus(ServiceStatus.Error);
                            _backendCard.SetExtraInfo("Health check échoué");
                            Log("⚠ Backend health check échoué", LogLevel.Warning);
                        }
                    }
                    catch
                    {
                        _backendCard.SetStatus(ServiceStatus.Error);
                        _backendCard.SetExtraInfo("Pas de réponse");
                    }
                }

                // Periodic MySQL check if backend is off
                if (!_backendRunning)
                {
                    bool mysqlOk = await Task.Run(() => IsMySQLRunning());
                    if (mysqlOk != _mysqlRunning)
                    {
                        _mysqlRunning = mysqlOk;
                        _mysqlCard.SetStatus(mysqlOk ? ServiceStatus.Running : ServiceStatus.Stopped);
                        _mysqlCard.SetExtraInfo(mysqlOk ? "Connecté — Port 3306" : "Non détecté");
                    }
                }
            };
            _healthTimer.Start();
        }

        private void ParseHealthResponse(string json)
        {
            try
            {
                using var doc = JsonDocument.Parse(json);
                var root = doc.RootElement;

                if (root.TryGetProperty("version", out var v))
                    _serverVersion = v.GetString() ?? "—";
                if (root.TryGetProperty("database", out var db))
                    _dbStatus = db.GetString() ?? "unknown";
                if (root.TryGetProperty("uptime", out var up))
                    _serverUptime = up.GetInt32();
            }
            catch { }
        }

        private void UpdateHeaderVersion()
        {
            if (_backendRunning)
            {
                var uptimeStr = FormatUptime(_serverUptime);
                _versionLabel.Text = $"Launcher v2.1.0 — Serveur: v{_serverVersion} — DB: {_dbStatus} — Uptime: {uptimeStr}";
                _versionLabel.ForeColor = _dbStatus == "connected" 
                    ? Color.FromArgb(180, 230, 180) 
                    : Color.FromArgb(255, 180, 180);
            }
            else
            {
                _versionLabel.Text = "Launcher v2.1.0 — Serveur: arrêté";
                _versionLabel.ForeColor = Color.FromArgb(160, 190, 230);
            }
        }

        private static string FormatUptime(int seconds)
        {
            if (seconds < 60) return $"{seconds}s";
            if (seconds < 3600) return $"{seconds / 60}m {seconds % 60}s";
            return $"{seconds / 3600}h {(seconds % 3600) / 60}m";
        }

        private void ShowTrayNotification(string title, string message)
        {
            if (_trayIcon != null && _trayIcon.Visible)
            {
                _trayIcon.ShowBalloonTip(3000, title, message, ToolTipIcon.Info);
            }
        }

        // ════════════════════════════════════════════════════════
        //  LOGGING
        // ════════════════════════════════════════════════════════
        private enum LogLevel { Info, Success, Warning, Error, Output }

        private void Log(string message, LogLevel level)
        {
            if (_logBox.IsDisposed) return;

            string timestamp = DateTime.Now.ToString("HH:mm:ss");
            string prefix = level switch
            {
                LogLevel.Success => "✓",
                LogLevel.Warning => "⚠",
                LogLevel.Error   => "✗",
                LogLevel.Output  => "│",
                _                => "ℹ"
            };
            Color color = level switch
            {
                LogLevel.Success => AccentGreen,
                LogLevel.Warning => AccentAmber,
                LogLevel.Error   => AccentRed,
                LogLevel.Output  => Color.FromArgb(107, 114, 128),
                _                => AccentBlue
            };

            _logBox.SelectionStart = _logBox.TextLength;
            _logBox.SelectionLength = 0;
            _logBox.SelectionColor = TextSecondary;
            _logBox.AppendText($"[{timestamp}] ");
            _logBox.SelectionStart = _logBox.TextLength;
            _logBox.SelectionColor = color;
            _logBox.AppendText($"{prefix} {message}\n");
            _logBox.ScrollToCaret();
        }

        private void ClearLogs()
        {
            _logBox.Clear();
            Log("Journal effacé", LogLevel.Info);
        }

        // ════════════════════════════════════════════════════════
        //  UTILITIES
        // ════════════════════════════════════════════════════════
        private void LoadIcon()
        {
            try
            {
                var iconPath = Path.Combine(_basePath, "assets", "icon.ico");
                if (File.Exists(iconPath))
                    Icon = new Icon(iconPath);
            }
            catch { }
        }

        private void PlayStartupSound()
        {
            try
            {
                var soundPath = Path.Combine(_basePath, "assets", "start.mp3");
                if (File.Exists(soundPath))
                {
                    // Use Windows Media Player COM for MP3 support
                    _ = Task.Run(() =>
                    {
                        try
                        {
                            var player = new System.Windows.Media.MediaPlayer();
                            player.Open(new Uri(soundPath));
                            player.Play();
                            System.Threading.Thread.Sleep(5000);
                        }
                        catch { }
                    });
                }
            }
            catch { }
        }

        private void SetStatus(string text) => _statusLabel.Text = text;

        private void UpdateGlobalStatus()
        {
            int running = (_mysqlRunning ? 1 : 0) + (_backendRunning ? 1 : 0) + (_frontendRunning ? 1 : 0);

            if (running == 3)
            {
                SetStatus("✓ Tous les services sont actifs (MySQL + Backend + Frontend)");
                _statusLabel.ForeColor = AccentGreen;
            }
            else if (running > 0)
            {
                var active = new List<string>();
                if (_mysqlRunning) active.Add("MySQL");
                if (_backendRunning) active.Add("Backend");
                if (_frontendRunning) active.Add("Frontend");
                SetStatus($"⚠ Actifs : {string.Join(", ", active)} ({running}/3)");
                _statusLabel.ForeColor = AccentAmber;
            }
            else
            {
                SetStatus("Prêt — Aucun service actif");
                _statusLabel.ForeColor = TextSecondary;
            }

            UpdateMasterButtons();
        }

        private void UpdateMasterButtons()
        {
            bool anyRunning = _backendRunning || _frontendRunning;
            bool allRunning = _backendRunning && _frontendRunning;

            _btnStartAll.Enabled = !allRunning;
            _btnStartAll.Cursor = !allRunning ? Cursors.Hand : Cursors.Default;

            _btnStopAll.Enabled = anyRunning;
            _btnStopAll.Cursor = anyRunning ? Cursors.Hand : Cursors.Default;

            _btnOpenBrowser.Enabled = anyRunning;
            _btnOpenBrowser.Cursor = anyRunning ? Cursors.Hand : Cursors.Default;
        }

        private string FindLogiTrackRoot()
        {
            var exeDir = AppDomain.CurrentDomain.BaseDirectory;
            var candidates = new[]
            {
                Path.GetFullPath(Path.Combine(exeDir, "..")),
                Path.GetFullPath(Path.Combine(exeDir, "..", "..")),
                Path.GetFullPath(Path.Combine(exeDir, "..", "..", "..")),
                Path.GetFullPath(Path.Combine(exeDir, "..", "..", "..", "..")),
                @"C:\laragon\www\logitrack"
            };

            foreach (var path in candidates)
            {
                if (Directory.Exists(Path.Combine(path, "backend")) &&
                    Directory.Exists(Path.Combine(path, "frontend")))
                    return path;
            }

            return @"C:\laragon\www\logitrack";
        }

        private string FindNodePath()
        {
            var candidates = new[]
            {
                @"C:\Program Files\nodejs\node.exe",
                @"C:\Program Files (x86)\nodejs\node.exe",
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), "nodejs", "node.exe"),
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "fnm_multishells", "node.exe")
            };

            foreach (var p in candidates)
                if (File.Exists(p)) return p;

            // Try PATH
            try
            {
                var proc = Process.Start(new ProcessStartInfo
                {
                    FileName = "where",
                    Arguments = "node",
                    UseShellExecute = false,
                    RedirectStandardOutput = true,
                    CreateNoWindow = true
                });
                proc?.WaitForExit(5000);
                var output = proc?.StandardOutput.ReadToEnd().Trim();
                if (!string.IsNullOrEmpty(output))
                    return output.Split(Environment.NewLine)[0].Trim();
            }
            catch { }

            return "node";
        }

        private string FindMysqlPath()
        {
            var candidates = new[]
            {
                @"C:\laragon\bin\mysql\mysql-8.0.30-winx64\bin\mysql.exe",
                @"C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe",
                @"C:\Program Files (x86)\MySQL\MySQL Server 8.0\bin\mysql.exe"
            };

            foreach (var p in candidates)
                if (File.Exists(p)) return p;

            // Search in Laragon
            try
            {
                var laragonMysql = @"C:\laragon\bin\mysql";
                if (Directory.Exists(laragonMysql))
                {
                    foreach (var dir in Directory.GetDirectories(laragonMysql))
                    {
                        var mysqlExe = Path.Combine(dir, "bin", "mysql.exe");
                        if (File.Exists(mysqlExe)) return mysqlExe;
                    }
                }
            }
            catch { }

            return "mysql";
        }

        private string FindNpxPath()
        {
            var nodeDir = Path.GetDirectoryName(_nodePath);
            if (nodeDir != null)
            {
                var npxCmd = Path.Combine(nodeDir, "npx.cmd");
                if (File.Exists(npxCmd)) return npxCmd;
            }

            return "npx.cmd";
        }

        private static void KillProcessTree(Process? process)
        {
            if (process == null || process.HasExited) return;

            try
            {
                var startInfo = new ProcessStartInfo
                {
                    FileName = "taskkill",
                    Arguments = $"/T /F /PID {process.Id}",
                    UseShellExecute = false,
                    CreateNoWindow = true
                };
                Process.Start(startInfo)?.WaitForExit(5000);
            }
            catch
            {
                try { process.Kill(true); } catch { }
            }
        }

        private static bool IsFontInstalled(string fontName)
        {
            using var testFont = new Font(fontName, 10F, FontStyle.Regular);
            return testFont.Name.Equals(fontName, StringComparison.OrdinalIgnoreCase);
        }

        protected override void OnResize(EventArgs e)
        {
            base.OnResize(e);
            if (WindowState == FormWindowState.Minimized)
            {
                Hide();
                if (_trayIcon != null)
                {
                    _trayIcon.Visible = true;
                    if (_backendRunning || _frontendRunning)
                        _trayIcon.ShowBalloonTip(2000, "LogiTrack", "Launcher minimisé dans la barre système", ToolTipIcon.Info);
                }
            }
        }

        protected override void OnFormClosing(FormClosingEventArgs e)
        {
            if (_backendRunning || _frontendRunning)
            {
                var result = MessageBox.Show(
                    "Des services sont encore en cours d'exécution.\n\n" +
                    "• Oui = Arrêter les services et quitter\n" +
                    "• Non = Minimiser dans la barre système\n" +
                    "• Annuler = Retour",
                    "LogiTrack Launcher v2.1.0",
                    MessageBoxButtons.YesNoCancel,
                    MessageBoxIcon.Question);

                if (result == DialogResult.Cancel)
                {
                    e.Cancel = true;
                    return;
                }

                if (result == DialogResult.No)
                {
                    e.Cancel = true;
                    WindowState = FormWindowState.Minimized;
                    return;
                }

                // Yes = stop and quit
                StopAll();
            }

            _healthTimer?.Stop();
            _httpClient?.Dispose();
            if (_trayIcon != null)
            {
                _trayIcon.Visible = false;
                _trayIcon.Dispose();
            }
            base.OnFormClosing(e);
        }
    }

    // ════════════════════════════════════════════════════════════
    //  CUSTOM: ServiceCard
    // ════════════════════════════════════════════════════════════
    public enum ServiceStatus { Stopped, Starting, Running, Error }

    public class ServiceCard : Panel
    {
        public string ServiceName { get; set; } = "Service";
        public string ServiceDescription { get; set; } = "";
        public string ServiceIcon { get; set; } = "🔧";
        public Color AccentColor { get; set; } = Color.FromArgb(56, 132, 255);
        public bool IsExternalService { get; set; } = false;
        
        public event EventHandler? StartClicked;
        public event EventHandler? StopClicked;

        private ServiceStatus _status = ServiceStatus.Stopped;
        private DateTime _startTime;
        private Label _statusLabel = null!;
        private Label _uptimeLabel = null!;
        private Label _extraInfoLabel = null!;
        private Label _nameLabel = null!;
        private Label _descLabel = null!;
        private Label _iconLabel = null!;
        private ModernButton _btnStart = null!;
        private ModernButton _btnStop = null!;
        private Panel _statusDot = null!;
        private System.Windows.Forms.Timer? _uptimeTimer;

        private static readonly Color BgCard = Color.White;
        private static readonly Color BorderCard = Color.FromArgb(229, 231, 235);
        private static readonly Color TextPrimary = Color.FromArgb(17, 24, 39);
        private static readonly Color TextSecondary = Color.FromArgb(107, 114, 128);
        private static readonly Color AccentGreen = Color.FromArgb(34, 197, 94);
        private static readonly Color AccentRed = Color.FromArgb(239, 68, 68);
        private static readonly Color AccentAmber = Color.FromArgb(245, 158, 11);

        public ServiceCard()
        {
            Height = 230;
            DoubleBuffered = true;
            SetStyle(ControlStyles.AllPaintingInWmPaint | ControlStyles.UserPaint | ControlStyles.OptimizedDoubleBuffer, true);
            BackColor = Color.Transparent;

            BuildUI();
        }

        private void BuildUI()
        {
            SuspendLayout();

            _iconLabel = new Label
            {
                Text = ServiceIcon,
                Font = new Font("Segoe UI Emoji", 24F),
                Size = new Size(50, 45),
                Location = new Point(15, 18),
                BackColor = Color.Transparent,
                TextAlign = ContentAlignment.MiddleCenter
            };

            _nameLabel = new Label
            {
                Text = ServiceName,
                Font = new Font("Segoe UI", 12F, FontStyle.Bold),
                ForeColor = TextPrimary,
                AutoSize = true,
                MaximumSize = new Size(200, 0),
                Location = new Point(65, 20),
                BackColor = Color.Transparent
            };

            _descLabel = new Label
            {
                Text = ServiceDescription,
                Font = new Font("Segoe UI", 8F),
                ForeColor = TextSecondary,
                AutoSize = true,
                MaximumSize = new Size(200, 0),
                Location = new Point(67, 44),
                BackColor = Color.Transparent
            };

            _statusDot = new Panel
            {
                Size = new Size(10, 10),
                Location = new Point(17, 80),
                BackColor = TextSecondary
            };
            _statusDot.Paint += (s, e) =>
            {
                e.Graphics.SmoothingMode = SmoothingMode.AntiAlias;
                using var brush = new SolidBrush(_statusDot.BackColor);
                e.Graphics.Clear(Color.White);
                e.Graphics.FillEllipse(brush, 0, 0, 9, 9);
            };

            _statusLabel = new Label
            {
                Text = "Arrêté",
                Font = new Font("Segoe UI", 9F, FontStyle.Bold),
                ForeColor = TextSecondary,
                AutoSize = true,
                Location = new Point(33, 76),
                BackColor = Color.Transparent
            };

            _uptimeLabel = new Label
            {
                Text = "",
                Font = new Font("Segoe UI", 7.5F),
                ForeColor = TextSecondary,
                AutoSize = true,
                MaximumSize = new Size(250, 0),
                Location = new Point(17, 98),
                BackColor = Color.Transparent
            };

            _extraInfoLabel = new Label
            {
                Text = "",
                Font = new Font("Segoe UI", 7.5F),
                ForeColor = AccentGreen,
                AutoSize = true,
                MaximumSize = new Size(250, 0),
                Location = new Point(17, 115),
                BackColor = Color.Transparent
            };

            _btnStart = new ModernButton
            {
                Text = "▶  Démarrer",
                GradientStart = AccentGreen,
                GradientEnd = Color.FromArgb(35, 134, 54),
                Location = new Point(15, 140),
                Size = new Size(110, 34),
                Font = new Font("Segoe UI", 8.5F, FontStyle.Bold)
            };
            _btnStart.Click += (_, e) => StartClicked?.Invoke(this, e);

            _btnStop = new ModernButton
            {
                Text = "⏹  Arrêter",
                GradientStart = AccentRed,
                GradientEnd = Color.FromArgb(180, 40, 38),
                Location = new Point(135, 140),
                Size = new Size(110, 34),
                Font = new Font("Segoe UI", 8.5F, FontStyle.Bold),
                Enabled = false
            };
            _btnStop.Click += (_, e) => StopClicked?.Invoke(this, e);

            Controls.AddRange(new Control[] 
            { 
                _iconLabel, _nameLabel, _descLabel, 
                _statusDot, _statusLabel, _uptimeLabel, _extraInfoLabel,
                _btnStart, _btnStop 
            });

            ResumeLayout(true);
        }

        protected override void OnResize(EventArgs eventargs)
        {
            base.OnResize(eventargs);
            if (_btnStart == null) return;

            int btnW = (Width - 45) / 2;
            if (btnW < 80) btnW = 80;
            _btnStart.SetBounds(15, 140, btnW, 34);
            _btnStop.SetBounds(15 + btnW + 8, 140, btnW, 34);

            _nameLabel.MaximumSize = new Size(Width - 80, 0);
            _descLabel.MaximumSize = new Size(Width - 80, 0);
            _uptimeLabel.MaximumSize = new Size(Width - 30, 0);
            _extraInfoLabel.MaximumSize = new Size(Width - 30, 0);
        }

        protected override void OnHandleCreated(EventArgs e)
        {
            base.OnHandleCreated(e);
            _iconLabel.Text = ServiceIcon;
            _nameLabel.Text = ServiceName;
            _descLabel.Text = ServiceDescription;
        }

        public void SetExtraInfo(string text)
        {
            _extraInfoLabel.Text = text;
            _extraInfoLabel.ForeColor = _status switch
            {
                ServiceStatus.Running => AccentGreen,
                ServiceStatus.Error => AccentRed,
                ServiceStatus.Starting => AccentAmber,
                _ => TextSecondary
            };
        }

        public void SetStatus(ServiceStatus status)
        {
            _status = status;

            switch (status)
            {
                case ServiceStatus.Stopped:
                    _statusLabel.Text = "Arrêté";
                    _statusLabel.ForeColor = TextSecondary;
                    _statusDot.BackColor = TextSecondary;
                    _btnStart.Enabled = true;
                    _btnStop.Enabled = false;
                    _uptimeLabel.Text = "";
                    _uptimeTimer?.Stop();
                    break;

                case ServiceStatus.Starting:
                    _statusLabel.Text = "Démarrage...";
                    _statusLabel.ForeColor = AccentAmber;
                    _statusDot.BackColor = AccentAmber;
                    _btnStart.Enabled = false;
                    _btnStop.Enabled = false;
                    _uptimeLabel.Text = "Veuillez patienter...";
                    break;

                case ServiceStatus.Running:
                    _statusLabel.Text = "En cours";
                    _statusLabel.ForeColor = AccentGreen;
                    _statusDot.BackColor = AccentGreen;
                    _btnStart.Enabled = false;
                    _btnStop.Enabled = !IsExternalService;
                    _startTime = DateTime.Now;
                    if (!IsExternalService) StartUptimeTimer();
                    break;

                case ServiceStatus.Error:
                    _statusLabel.Text = "Erreur";
                    _statusLabel.ForeColor = AccentRed;
                    _statusDot.BackColor = AccentRed;
                    _btnStart.Enabled = true;
                    _btnStop.Enabled = !IsExternalService;
                    _uptimeTimer?.Stop();
                    break;
            }

            _statusDot.Invalidate();
            Invalidate();
        }

        private void StartUptimeTimer()
        {
            _uptimeTimer?.Stop();
            _uptimeTimer = new System.Windows.Forms.Timer { Interval = 1000 };
            _uptimeTimer.Tick += (_, _) => UpdateUptime();
            _uptimeTimer.Start();
        }

        public void UpdateUptime()
        {
            if (_status != ServiceStatus.Running) return;
            var elapsed = DateTime.Now - _startTime;
            _uptimeLabel.Text = $"Uptime: {elapsed:hh\\:mm\\:ss}";
            _uptimeLabel.ForeColor = AccentGreen;
        }

        protected override void OnPaint(PaintEventArgs e)
        {
            var g = e.Graphics;
            g.SmoothingMode = SmoothingMode.AntiAlias;

            var rect = new Rectangle(0, 0, Width - 1, Height - 1);
            int radius = 12;

            using var path = RoundedRectPath(rect, radius);
            using var bgBrush = new SolidBrush(BgCard);
            g.FillPath(bgBrush, path);

            using var borderPen = new Pen(_status == ServiceStatus.Running ? AccentColor : BorderCard, 1.5f);
            g.DrawPath(borderPen, path);

            var accentRect = new Rectangle(1, 1, Width - 3, 4);
            using var accentPath = RoundedRectPath(accentRect, radius, topOnly: true);
            using var accentBrush = new SolidBrush(
                _status == ServiceStatus.Running ? AccentColor : 
                _status == ServiceStatus.Error ? AccentRed :
                Color.FromArgb(60, AccentColor));
            g.FillPath(accentBrush, accentPath);
        }

        private static GraphicsPath RoundedRectPath(Rectangle rect, int radius, bool topOnly = false)
        {
            var path = new GraphicsPath();
            int d = radius * 2;

            path.AddArc(rect.X, rect.Y, d, d, 180, 90);
            path.AddArc(rect.Right - d, rect.Y, d, d, 270, 90);

            if (topOnly)
            {
                path.AddLine(rect.Right, rect.Bottom, rect.X, rect.Bottom);
            }
            else
            {
                path.AddArc(rect.Right - d, rect.Bottom - d, d, d, 0, 90);
                path.AddArc(rect.X, rect.Bottom - d, d, d, 90, 90);
            }

            path.CloseFigure();
            return path;
        }
    }

    // ════════════════════════════════════════════════════════════
    //  CUSTOM: ModernButton
    // ════════════════════════════════════════════════════════════
    public class ModernButton : Control
    {
        public Color GradientStart { get; set; } = Color.FromArgb(56, 132, 255);
        public Color GradientEnd { get; set; } = Color.FromArgb(40, 100, 210);

        private bool _hovering;
        private bool _pressing;

        public ModernButton()
        {
            SetStyle(ControlStyles.AllPaintingInWmPaint | ControlStyles.UserPaint |
                     ControlStyles.OptimizedDoubleBuffer | ControlStyles.ResizeRedraw, true);
            Size = new Size(150, 40);
            Font = new Font("Segoe UI", 9.5F, FontStyle.Bold);
            Cursor = Cursors.Hand;
        }

        protected override void OnPaint(PaintEventArgs e)
        {
            var g = e.Graphics;
            g.SmoothingMode = SmoothingMode.AntiAlias;
            g.TextRenderingHint = System.Drawing.Text.TextRenderingHint.ClearTypeGridFit;

            var rect = new Rectangle(0, 0, Width - 1, Height - 1);
            int radius = 8;

            using var path = RoundedRect(rect, radius);

            if (!Enabled)
            {
                using var disabledBrush = new SolidBrush(Color.FromArgb(229, 231, 235));
                g.FillPath(disabledBrush, path);
                using var disabledPen = new Pen(Color.FromArgb(209, 213, 219));
                g.DrawPath(disabledPen, path);
                DrawText(g, rect, Color.FromArgb(156, 163, 175));
                return;
            }

            Color c1 = _pressing ? Darken(GradientStart, 0.2f) : _hovering ? Lighten(GradientStart, 0.08f) : GradientStart;
            Color c2 = _pressing ? Darken(GradientEnd, 0.2f) : _hovering ? Lighten(GradientEnd, 0.08f) : GradientEnd;

            using var gradBrush = new LinearGradientBrush(rect, c1, c2, LinearGradientMode.Vertical);
            g.FillPath(gradBrush, path);

            DrawText(g, rect, Color.White);
        }

        private void DrawText(Graphics g, Rectangle rect, Color textColor)
        {
            using var brush = new SolidBrush(textColor);
            using var sf = new StringFormat
            {
                Alignment = StringAlignment.Center,
                LineAlignment = StringAlignment.Center
            };
            g.DrawString(Text, Font, brush, rect, sf);
        }

        protected override void OnMouseEnter(EventArgs e) { _hovering = true; Invalidate(); base.OnMouseEnter(e); }
        protected override void OnMouseLeave(EventArgs e) { _hovering = false; _pressing = false; Invalidate(); base.OnMouseLeave(e); }
        protected override void OnMouseDown(MouseEventArgs e) { if (e.Button == MouseButtons.Left) { _pressing = true; Invalidate(); } base.OnMouseDown(e); }
        protected override void OnMouseUp(MouseEventArgs e) { _pressing = false; Invalidate(); base.OnMouseUp(e); }

        private static GraphicsPath RoundedRect(Rectangle rect, int radius)
        {
            var path = new GraphicsPath();
            int d = radius * 2;
            path.AddArc(rect.X, rect.Y, d, d, 180, 90);
            path.AddArc(rect.Right - d, rect.Y, d, d, 270, 90);
            path.AddArc(rect.Right - d, rect.Bottom - d, d, d, 0, 90);
            path.AddArc(rect.X, rect.Bottom - d, d, d, 90, 90);
            path.CloseFigure();
            return path;
        }

        private static Color Lighten(Color c, float amount) =>
            Color.FromArgb(c.A,
                Math.Min(255, (int)(c.R + (255 - c.R) * amount)),
                Math.Min(255, (int)(c.G + (255 - c.G) * amount)),
                Math.Min(255, (int)(c.B + (255 - c.B) * amount)));

        private static Color Darken(Color c, float amount) =>
            Color.FromArgb(c.A,
                Math.Max(0, (int)(c.R * (1 - amount))),
                Math.Max(0, (int)(c.G * (1 - amount))),
                Math.Max(0, (int)(c.B * (1 - amount))));
    }
}
