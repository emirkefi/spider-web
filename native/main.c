#include <gtk/gtk.h>
#include <webkit/webkit.h>
#include "bundle.h"

static void on_activate(GtkApplication *app, gpointer user_data) {
    // If window already exists, present it (single-instance behavior on Hyprland)
    GtkWindow *existing = gtk_application_get_active_window(app);
    if (existing != NULL) {
        gtk_window_present(existing);
        return;
    }

    GtkWidget *window = gtk_application_window_new(app);
    gtk_window_set_title(GTK_WINDOW(window), "SpiderWeb Kanban");
    gtk_window_set_default_size(GTK_WINDOW(window), 1420, 880);

    // Persistent data manager so localStorage (tasks, projects, theme) is saved natively in ~/.local/share/spiderweb
    gchar *data_dir = g_build_filename(g_get_user_data_dir(), "spiderweb", NULL);
    gchar *cache_dir = g_build_filename(g_get_user_cache_dir(), "spiderweb", NULL);

    WebKitNetworkSession *session = webkit_network_session_new(data_dir, cache_dir);
    WebKitWebsiteDataManager *data_mgr = webkit_network_session_get_website_data_manager(session);
    (void)data_mgr;

    WebKitSettings *settings = webkit_settings_new();
    webkit_settings_set_enable_developer_extras(settings, FALSE);
    webkit_settings_set_enable_page_cache(settings, TRUE);
    webkit_settings_set_enable_smooth_scrolling(settings, TRUE);
    webkit_settings_set_hardware_acceleration_policy(
        settings, WEBKIT_HARDWARE_ACCELERATION_POLICY_ALWAYS
    );

    GtkWidget *webview = g_object_new(
        WEBKIT_TYPE_WEB_VIEW,
        "network-session", session,
        "settings", settings,
        NULL
    );

    // Dark translucent background while initializing to prevent white flash on Hyprland
    GdkRGBA bg_color = { 0.043f, 0.047f, 0.063f, 1.0f };
    webkit_web_view_set_background_color(WEBKIT_WEB_VIEW(webview), &bg_color);

    gtk_widget_set_hexpand(webview, TRUE);
    gtk_widget_set_vexpand(webview, TRUE);
    gtk_window_set_child(GTK_WINDOW(window), webview);

    // Load the embedded application HTML directly from memory with a stable local origin for localStorage
    GBytes *html_bytes = g_bytes_new_static(SPIDERWEB_HTML, SPIDERWEB_HTML_LEN);
    webkit_web_view_load_bytes(
        WEBKIT_WEB_VIEW(webview),
        html_bytes,
        "text/html",
        "UTF-8",
        "file:///spiderweb/index.html"
    );
    g_bytes_unref(html_bytes);

    gtk_window_present(GTK_WINDOW(window));

    g_free(data_dir);
    g_free(cache_dir);
    g_object_unref(settings);
    g_object_unref(session);
}

int main(int argc, char **argv) {
    // Prefer native Wayland backend on Hyprland
    g_setenv("GDK_BACKEND", "wayland,x11", FALSE);

    GtkApplication *app = gtk_application_new(
        "dev.hyprland.spiderweb",
        G_APPLICATION_DEFAULT_FLAGS
    );

    g_signal_connect(app, "activate", G_CALLBACK(on_activate), NULL);
    int status = g_application_run(G_APPLICATION(app), argc, argv);
    g_object_unref(app);

    return status;
}
