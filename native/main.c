#include <gtk/gtk.h>
#include <webkit/webkit.h>
#include "bundle.h"

// Handler for WebKitGTK JavaScript message "systemNotification"
static void on_notification_message(WebKitUserContentManager *manager,
                                    JSCValue *value,
                                    gpointer user_data) {
    (void)manager;
    (void)user_data;

    gchar *title_str = NULL;
    gchar *body_str = NULL;

    if (jsc_value_is_object(value)) {
        JSCValue *t_val = jsc_value_object_get_property(value, "title");
        if (t_val && !jsc_value_is_undefined(t_val) && !jsc_value_is_null(t_val)) {
            title_str = jsc_value_to_string(t_val);
        }
        JSCValue *b_val = jsc_value_object_get_property(value, "body");
        if (b_val && !jsc_value_is_undefined(b_val) && !jsc_value_is_null(b_val)) {
            body_str = jsc_value_to_string(b_val);
        }
    } else if (jsc_value_is_string(value)) {
        char *str = jsc_value_to_string(value);
        if (str) {
            char *t_ptr = strstr(str, "\"title\":");
            if (t_ptr) {
                t_ptr += 8;
                while (*t_ptr == ' ' || *t_ptr == '\"') t_ptr++;
                char *end_t = strchr(t_ptr, '\"');
                if (end_t) title_str = g_strndup(t_ptr, end_t - t_ptr);
            }
            char *b_ptr = strstr(str, "\"body\":");
            if (b_ptr) {
                b_ptr += 7;
                while (*b_ptr == ' ' || *b_ptr == '\"') b_ptr++;
                char *end_b = strchr(b_ptr, '\"');
                if (end_b) body_str = g_strndup(b_ptr, end_b - b_ptr);
            }
            if (!title_str && !body_str) {
                title_str = g_strdup("SpiderWeb");
                body_str = g_strdup(str);
            }
            g_free(str);
        }
    }

    const gchar *final_title = (title_str && *title_str) ? title_str : "SpiderWeb";
    const gchar *final_body = (body_str && *body_str) ? body_str : "Task Notification";

    gchar *icon_path = g_build_filename(g_get_user_data_dir(), "icons", "hicolor", "scalable", "apps", "spiderweb.svg", NULL);
    const gchar *icon_arg = g_file_test(icon_path, G_FILE_TEST_EXISTS) ? icon_path : "spiderweb";

    // Direct spawn of notify-send without shell escaping issues
    char *argv[] = {
        "notify-send",
        "-a", "SpiderWeb",
        "-i", (char *)icon_arg,
        (char *)final_title,
        (char *)final_body,
        NULL
    };

    g_spawn_async(NULL, argv, NULL, G_SPAWN_SEARCH_PATH, NULL, NULL, NULL, NULL);

    g_free(icon_path);
    g_free(title_str);
    g_free(body_str);
}

// Auto-allow notification permissions inside native standalone WebKit view
static gboolean on_permission_request(WebKitWebView *web_view,
                                      WebKitPermissionRequest *request,
                                      gpointer user_data) {
    (void)web_view;
    (void)user_data;
    if (WEBKIT_IS_NOTIFICATION_PERMISSION_REQUEST(request)) {
        webkit_permission_request_allow(request);
        return TRUE;
    }
    return FALSE;
}

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

    // Setup Content Manager for Native Notification Bridge
    WebKitUserContentManager *content_manager = webkit_user_content_manager_new();
    g_signal_connect(content_manager, "script-message-received::systemNotification",
                     G_CALLBACK(on_notification_message), NULL);
    webkit_user_content_manager_register_script_message_handler(
        content_manager,
        "systemNotification",
        NULL
    );

    GtkWidget *webview = g_object_new(
        WEBKIT_TYPE_WEB_VIEW,
        "network-session", session,
        "settings", settings,
        "user-content-manager", content_manager,
        NULL
    );

    g_signal_connect(webview, "permission-request",
                     G_CALLBACK(on_permission_request), NULL);

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

    // Ensure Rust iroh P2P networking core is running in the background
    const char *core_path = "/home/umbra/Projects/Coding/spider-web/src-tauri/target/debug/spiderweb-core";
    if (g_file_test(core_path, G_FILE_TEST_IS_EXECUTABLE)) {
        char *core_argv[] = { (char *)core_path, NULL };
        g_spawn_async(NULL, core_argv, NULL, G_SPAWN_DEFAULT, NULL, NULL, NULL, NULL);
    }

    GtkApplication *app = gtk_application_new(
        "dev.hyprland.spiderweb",
        G_APPLICATION_DEFAULT_FLAGS
    );

    g_signal_connect(app, "activate", G_CALLBACK(on_activate), NULL);
    int status = g_application_run(G_APPLICATION(app), argc, argv);
    g_object_unref(app);

    return status;
}
