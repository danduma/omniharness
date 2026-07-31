package dev.omniharness.app;

import android.Manifest;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;
import android.util.Base64;
import androidx.core.app.NotificationCompat;
import androidx.core.content.ContextCompat;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.security.cert.CertificateException;
import java.security.cert.X509Certificate;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.Iterator;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;
import javax.net.ssl.SSLContext;
import javax.net.ssl.SSLHandshakeException;
import javax.net.ssl.TrustManager;
import javax.net.ssl.TrustManagerFactory;
import javax.net.ssl.X509TrustManager;
import okhttp3.Call;
import okhttp3.Callback;
import okhttp3.CertificatePinner;
import okhttp3.Headers;
import okhttp3.MediaType;
import okhttp3.MultipartBody;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.RequestBody;
import okhttp3.Response;
import okhttp3.ResponseBody;
import okio.BufferedSource;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

@CapacitorPlugin(name = "OmniNativeRuntime")
public final class OmniNativeRuntimePlugin extends Plugin {

    private static final String PREFS = "omniharness-native-runtime";
    private static final String KEY_ALIAS = "omniharness-runner-sessions";
    private static final String CHANNEL_ID = "omniharness-conversations";
    private static final int MAX_QUEUED_FRAMES = 256;
    private static final int MAX_QUEUED_BYTES = 1024 * 1024;
    private static final Set<String> METHODS = Set.of("GET", "POST", "PUT", "PATCH", "DELETE");
    private static final Set<String> BLOCKED_HEADERS = Set.of("authorization", "cookie", "origin", "host");

    private final Map<String, Call> requestCalls = new ConcurrentHashMap<>();
    private final Map<String, StreamConfiguration> streamConfigurations = new ConcurrentHashMap<>();
    private final Map<String, Call> streamCalls = new ConcurrentHashMap<>();
    private final ExecutorService frameExecutor = Executors.newSingleThreadExecutor();
    private final Object frameLock = new Object();
    private int queuedFrames = 0;
    private int queuedBytes = 0;
    private volatile boolean suspended = false;
    private SharedPreferences preferences;
    private NativeCredentialStore credentials;

    @Override
    public void load() {
        preferences = getContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        credentials = new NativeCredentialStore(getContext(), preferences);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager manager = getContext().getSystemService(NotificationManager.class);
            manager.createNotificationChannel(new NotificationChannel(
                CHANNEL_ID,
                "OmniHarness conversations",
                NotificationManager.IMPORTANCE_DEFAULT
            ));
        }
    }

    @PluginMethod
    public void request(PluginCall call) {
        try {
            Target target = parseTarget(call);
            String requestId = required(call.getString("requestId"), "Request id is required.");
            String method = call.getString("method", "GET").toUpperCase(Locale.ROOT);
            String path = validatedPath(call.getString("path"));
            Request request = makeRequest(
                target,
                path,
                method,
                call.getObject("headers", new JSObject()),
                call.getString("bodyText"),
                call.getArray("formData"),
                requiresCredential(method, path)
            );
            OkHttpClient client = clientFor(target);
            Call nativeCall = client.newCall(request);
            requestCalls.put(requestId, nativeCall);
            nativeCall.enqueue(new Callback() {
                @Override
                public void onFailure(Call ignored, IOException error) {
                    requestCalls.remove(requestId);
                    resolveNetworkFailure(call, target, error);
                }

                @Override
                public void onResponse(Call ignored, Response response) {
                    requestCalls.remove(requestId);
                    try (response) {
                        call.resolve(responseObject(
                            response,
                            call.getString("responseType")
                        ));
                    } catch (Exception error) {
                        call.reject(
                            "Runner response could not be read.",
                            "runtime.response_invalid",
                            error
                        );
                    }
                }
            });
        } catch (Exception error) {
            call.reject(error.getMessage(), "runtime.native_invalid", error);
        }
    }

    @PluginMethod
    public void cancelRequest(PluginCall call) {
        String requestId = call.getString("requestId");
        Call pending = requestId == null ? null : requestCalls.remove(requestId);
        if (pending != null) pending.cancel();
        call.resolve(new JSObject().put("ok", true));
    }

    @PluginMethod
    public void authorize(PluginCall call) {
        try {
            Target target = parseTarget(call);
            String password = required(
                call.getString("password"),
                "Runner password is required."
            );
            String label = call.getString("clientLabel", "OmniHarness Android");
            JSONObject payload = new JSONObject()
                .put("password", password)
                .put("tokenTransport", "bearer")
                .put("clientLabel", label);
            Request request = makeRequest(
                target,
                "/api/auth/login",
                "POST",
                new JSObject().put("content-type", "application/json"),
                payload.toString(),
                null,
                false
            );
            clientFor(target).newCall(request).enqueue(new Callback() {
                @Override
                public void onFailure(Call ignored, IOException error) {
                    rejectNetworkFailure(call, target, error);
                }

                @Override
                public void onResponse(Call ignored, Response response) {
                    try (response) {
                        ResponseBody body = response.body();
                        JSONObject result = new JSONObject(body == null ? "{}" : body.string());
                        if (!response.isSuccessful() || !result.has("token")) {
                            call.reject(
                                result.optJSONObject("error") == null
                                    ? "Runner login failed."
                                    : result.optJSONObject("error").optString(
                                        "message",
                                        "Runner login failed."
                                    ),
                                "runtime.login_failed"
                            );
                            return;
                        }
                        String handle = "mobile-" + UUID.randomUUID().toString();
                        JSONObject record = new JSONObject()
                            .put("profileId", target.profileId)
                            .put("origin", target.baseUrl)
                            .put("runnerInstanceId", target.runnerInstanceId)
                            .put("token", result.getString("token"))
                            .put("createdAt", Instant.now().toString());
                        credentials.save(handle, record);
                        call.resolve(new JSObject().put("credentialRef", handle));
                    } catch (Exception error) {
                        call.reject(
                            "Runner login response was invalid.",
                            "runtime.login_failed",
                            error
                        );
                    }
                }
            });
        } catch (Exception error) {
            call.reject(error.getMessage(), "runtime.native_invalid", error);
        }
    }

    @PluginMethod
    public void credential(PluginCall call) {
        String command = call.getString("command", "");
        JSObject payload = call.getObject("payload", new JSObject());
        String handle = payload.getString("handle");
        try {
            switch (command) {
                case "metadata": {
                    JSONObject record = handle == null ? null : credentials.read(handle);
                    JSObject result = new JSObject();
                    if (record == null) {
                        result.put("value", null);
                    } else {
                        result.put("value", new JSObject()
                            .put("profileId", record.optString("profileId"))
                            .put("origin", record.optString("origin"))
                            .put(
                                "runnerInstanceId",
                                record.isNull("runnerInstanceId")
                                    ? null
                                    : record.optString("runnerInstanceId")
                            )
                            .put("createdAt", record.optString("createdAt"))
                        );
                    }
                    call.resolve(result);
                    break;
                }
                case "rebind": {
                    JSONObject record = handle == null ? null : credentials.read(handle);
                    JSObject binding = payload.getJSObject("binding");
                    if (record == null || binding == null) {
                        throw new IllegalArgumentException("Credential handle is invalid.");
                    }
                    record.put("origin", binding.getString("origin"));
                    record.put(
                        "runnerInstanceId",
                        binding.isNull("runnerInstanceId")
                            ? JSONObject.NULL
                            : binding.getString("runnerInstanceId")
                    );
                    credentials.save(handle, record);
                    call.resolve();
                    break;
                }
                case "clear":
                    if (handle != null) credentials.delete(handle);
                    call.resolve();
                    break;
                case "clearForProfile":
                    credentials.clearForProfile(payload.getString("profileId"));
                    call.resolve();
                    break;
                default:
                    call.reject(
                        "Unknown credential command.",
                        "runtime.credential_command_invalid"
                    );
            }
        } catch (Exception error) {
            call.reject(
                error.getMessage(),
                "runtime.credential_store_failed",
                error
            );
        }
    }

    @PluginMethod
    public void confirmTls(PluginCall call) {
        String profileId = call.getString("profileId");
        String origin = call.getString("origin");
        String fingerprint = call.getString("fingerprint");
        String pending = preferences.getString(pendingKey(profileId), null);
        try {
            JSONObject value = pending == null ? null : new JSONObject(pending);
            if (
                value == null
                    || !origin.equals(value.optString("origin"))
                    || !fingerprint.equals(value.optString("fingerprint"))
            ) {
                call.reject(
                    "The certificate no longer matches the pending confirmation.",
                    "runtime.tls_confirmation_stale"
                );
                return;
            }
            preferences.edit()
                .putString(pinKey(profileId, origin), fingerprint)
                .remove(pendingKey(profileId))
                .apply();
            call.resolve(new JSObject().put("ok", true));
        } catch (Exception error) {
            call.reject(
                "Certificate confirmation is invalid.",
                "runtime.tls_confirmation_stale",
                error
            );
        }
    }

    @PluginMethod
    public void openStream(PluginCall call) {
        try {
            String streamId = required(
                call.getString("streamId"),
                "Stream id is required."
            );
            Target target = parseTarget(call);
            String path = validatedPath(call.getString("path"));
            String cursor = call.getString(
                "lastEventId",
                preferences.getString(cursorKey(target.profileId, path), null)
            );
            StreamConfiguration configuration = new StreamConfiguration(
                streamId,
                target,
                path,
                cursor
            );
            streamConfigurations.put(streamId, configuration);
            if (!suspended) startStream(configuration);
            call.resolve(new JSObject().put("ok", true));
        } catch (Exception error) {
            call.reject(error.getMessage(), "runtime.stream_invalid", error);
        }
    }

    @PluginMethod
    public void closeStream(PluginCall call) {
        String streamId = call.getString("streamId");
        if (streamId != null) {
            streamConfigurations.remove(streamId);
            Call pending = streamCalls.remove(streamId);
            if (pending != null) pending.cancel();
        }
        call.resolve(new JSObject().put("ok", true));
    }

    @PluginMethod
    public void openExternal(PluginCall call) {
        try {
            Uri uri = Uri.parse(required(call.getString("url"), "URL is required."));
            String scheme = uri.getScheme() == null
                ? ""
                : uri.getScheme().toLowerCase(Locale.ROOT);
            if (!Set.of("https", "http", "mailto").contains(scheme)) {
                throw new IllegalArgumentException("External URL is invalid.");
            }
            Intent intent = new Intent(Intent.ACTION_VIEW, uri);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
            call.resolve(new JSObject().put("ok", true));
        } catch (Exception error) {
            call.reject(
                error.getMessage(),
                "runtime.external_open_failed",
                error
            );
        }
    }

    @PluginMethod
    public void notify(PluginCall call) {
        String title = call.getString("title");
        if (title == null || title.isBlank()) {
            call.reject(
                "Notification title is required.",
                "runtime.notification_invalid"
            );
            return;
        }
        if (
            Build.VERSION.SDK_INT >= 33
                && ContextCompat.checkSelfPermission(
                    getContext(),
                    Manifest.permission.POST_NOTIFICATIONS
                ) != PackageManager.PERMISSION_GRANTED
        ) {
            call.resolve(new JSObject().put("ok", false));
            return;
        }
        NotificationManager manager = (NotificationManager) getContext()
            .getSystemService(Context.NOTIFICATION_SERVICE);
        NotificationCompat.Builder builder = new NotificationCompat.Builder(
            getContext(),
            CHANNEL_ID
        )
            .setSmallIcon(android.R.drawable.stat_notify_chat)
            .setContentTitle(title)
            .setContentText(call.getString("body", ""))
            .setAutoCancel(true);
        manager.notify((int) (System.currentTimeMillis() & 0x7fffffff), builder.build());
        call.resolve(new JSObject().put("ok", true));
    }

    @Override
    protected void handleOnPause() {
        suspended = true;
        for (Call pending : streamCalls.values()) pending.cancel();
        streamCalls.clear();
    }

    @Override
    protected void handleOnResume() {
        suspended = false;
        for (StreamConfiguration configuration : streamConfigurations.values()) {
            startStream(configuration);
        }
    }

    @Override
    protected void handleOnDestroy() {
        for (Call pending : requestCalls.values()) pending.cancel();
        for (Call pending : streamCalls.values()) pending.cancel();
        requestCalls.clear();
        streamCalls.clear();
        frameExecutor.shutdownNow();
    }

    private void startStream(StreamConfiguration configuration) {
        Call previous = streamCalls.remove(configuration.streamId);
        if (previous != null) previous.cancel();
        try {
            JSObject headers = new JSObject().put("accept", "text/event-stream");
            if (
                configuration.lastEventId != null
                    && !configuration.lastEventId.isBlank()
            ) {
                headers.put("Last-Event-ID", configuration.lastEventId);
            }
            Request request = makeRequest(
                configuration.target,
                configuration.path,
                "GET",
                headers,
                null,
                null,
                true
            );
            Call nativeCall = clientFor(configuration.target).newCall(request);
            streamCalls.put(configuration.streamId, nativeCall);
            nativeCall.enqueue(new Callback() {
                @Override
                public void onFailure(Call ignored, IOException error) {
                    streamCalls.remove(configuration.streamId);
                    if (
                        !suspended
                            && streamConfigurations.containsKey(
                                configuration.streamId
                            )
                            && !ignored.isCanceled()
                    ) {
                        new Handler(Looper.getMainLooper()).postDelayed(
                            () -> {
                                StreamConfiguration current =
                                    streamConfigurations.get(configuration.streamId);
                                if (current != null && !suspended) {
                                    startStream(current);
                                }
                            },
                            1000
                        );
                    }
                }

                @Override
                public void onResponse(Call ignored, Response response) {
                    try (response) {
                        if (!response.isSuccessful() || response.body() == null) {
                            throw new IOException(
                                "Runtime stream failed with HTTP "
                                    + response.code()
                                    + "."
                            );
                        }
                        readEventStream(response.body().source(), configuration);
                    } catch (IOException error) {
                        if (!ignored.isCanceled()) onFailure(ignored, error);
                    } finally {
                        streamCalls.remove(configuration.streamId);
                    }
                }
            });
        } catch (Exception error) {
            emitFrame(
                configuration,
                "error",
                new JSONObject()
                    .put("code", "runtime.stream_failed")
                    .put("message", error.getMessage())
                    .toString(),
                null
            );
        }
    }

    private void readEventStream(
        BufferedSource source,
        StreamConfiguration configuration
    ) throws IOException {
        String event = "message";
        List<String> data = new ArrayList<>();
        String cursor = null;
        while (!source.exhausted() && streamConfigurations.containsKey(configuration.streamId)) {
            String line = source.readUtf8Line();
            if (line == null) break;
            if (line.isEmpty()) {
                if (!data.isEmpty()) {
                    emitFrame(
                        configuration,
                        event,
                        String.join("\n", data),
                        cursor
                    );
                }
                event = "message";
                data.clear();
                cursor = null;
            } else if (line.startsWith("event:")) {
                event = line.substring(6).trim();
            } else if (line.startsWith("data:")) {
                data.add(line.substring(5).trim());
            } else if (line.startsWith("id:")) {
                cursor = line.substring(3).trim();
            }
        }
    }

    private void emitFrame(
        StreamConfiguration configuration,
        String event,
        String data,
        String cursor
    ) {
        int bytes = data.getBytes(StandardCharsets.UTF_8).length;
        synchronized (frameLock) {
            if (
                queuedFrames >= MAX_QUEUED_FRAMES
                    || queuedBytes + bytes > MAX_QUEUED_BYTES
            ) {
                Call pending = streamCalls.remove(configuration.streamId);
                if (pending != null) pending.cancel();
                return;
            }
            queuedFrames++;
            queuedBytes += bytes;
        }
        if (cursor != null && !cursor.isBlank()) {
            configuration.lastEventId = cursor;
            preferences.edit()
                .putString(
                    cursorKey(configuration.target.profileId, configuration.path),
                    cursor
                )
                .apply();
        }
        frameExecutor.execute(() -> {
            try {
                JSObject frame = new JSObject()
                    .put("streamId", configuration.streamId)
                    .put("type", event)
                    .put("data", data);
                if (cursor != null) frame.put("lastEventId", cursor);
                notifyListeners("streamFrame", frame);
            } finally {
                synchronized (frameLock) {
                    queuedFrames = Math.max(0, queuedFrames - 1);
                    queuedBytes = Math.max(0, queuedBytes - bytes);
                }
            }
        });
    }

    private OkHttpClient clientFor(Target target) throws Exception {
        String pin = preferences.getString(pinKey(target.profileId, target.baseUrl), null);
        RecordingTrustManager trustManager = new RecordingTrustManager(
            systemTrustManager(),
            pin,
            fingerprint -> preferences.edit()
                .putString(
                    pendingKey(target.profileId),
                    new JSONObject()
                        .put("origin", target.baseUrl)
                        .put("fingerprint", fingerprint)
                        .toString()
                )
                .apply()
        );
        SSLContext context = SSLContext.getInstance("TLS");
        context.init(null, new TrustManager[] { trustManager }, new SecureRandom());
        OkHttpClient.Builder builder = new OkHttpClient.Builder()
            .sslSocketFactory(context.getSocketFactory(), trustManager)
            .retryOnConnectionFailure(true);
        if (pin != null && target.host != null) {
            // CertificatePinner provides a second, hostname-scoped SPKI check.
            builder.certificatePinner(
                new CertificatePinner.Builder().add(target.host, pin).build()
            );
        }
        return builder.build();
    }

    private Request makeRequest(
        Target target,
        String path,
        String method,
        JSObject headers,
        String bodyText,
        JSArray formData,
        boolean requireCredential
    ) throws Exception {
        if (!METHODS.contains(method)) {
            throw new IllegalArgumentException("HTTP method is not allowed.");
        }
        Uri uri = Uri.parse(target.baseUrl + path);
        if (!target.host.equals(uri.getHost())) {
            throw new IllegalArgumentException("Runner request path is invalid.");
        }
        validateTransport(uri);
        Request.Builder builder = new Request.Builder().url(uri.toString());
        Iterator<String> headerNames = headers.keys();
        while (headerNames.hasNext()) {
            String key = headerNames.next();
            if (!BLOCKED_HEADERS.contains(key.toLowerCase(Locale.ROOT))) {
                String value = headers.getString(key);
                if (value != null) builder.header(key, value);
            }
        }
        if (requireCredential) {
            JSONObject record = target.credentialRef == null
                ? null
                : credentials.read(target.credentialRef);
            if (
                record == null
                    || !target.profileId.equals(record.optString("profileId"))
                    || !target.baseUrl.equals(record.optString("origin"))
                    || !equalNullable(
                        target.runnerInstanceId,
                        record.isNull("runnerInstanceId")
                            ? null
                            : record.optString("runnerInstanceId")
                    )
            ) {
                throw new IllegalStateException("Runner authorization is required.");
            }
            builder.header(
                "Authorization",
                "Bearer " + record.getString("token")
            );
        }
        RequestBody body = null;
        if (formData != null) {
            MultipartBody.Builder multipart = new MultipartBody.Builder()
                .setType(MultipartBody.FORM);
            for (int index = 0; index < formData.length(); index++) {
                JSONObject entry = formData.getJSONObject(index);
                String name = entry.getString("name");
                if (entry.has("value")) {
                    multipart.addFormDataPart(name, entry.getString("value"));
                } else {
                    JSONObject file = entry.getJSONObject("file");
                    byte[] bytes = Base64.decode(
                        file.getString("base64"),
                        Base64.DEFAULT
                    );
                    multipart.addFormDataPart(
                        name,
                        file.getString("name"),
                        RequestBody.create(
                            bytes,
                            MediaType.parse(
                                file.optString(
                                    "type",
                                    "application/octet-stream"
                                )
                            )
                        )
                    );
                }
            }
            body = multipart.build();
        } else if (bodyText != null) {
            body = RequestBody.create(
                bodyText,
                MediaType.parse(
                    headers.getString("content-type", "application/json")
                )
            );
        } else if (!method.equals("GET")) {
            body = RequestBody.create(new byte[0], null);
        }
        builder.method(method, body);
        return builder.build();
    }

    private JSObject responseObject(Response response, String responseType)
        throws IOException {
        JSObject result = new JSObject()
            .put("status", response.code())
            .put("headers", headersObject(response.headers()));
        ResponseBody body = response.body();
        byte[] bytes = body == null ? new byte[0] : body.bytes();
        if ("blob".equals(responseType) || "arrayBuffer".equals(responseType)) {
            result.put(
                "bodyBase64",
                Base64.encodeToString(bytes, Base64.NO_WRAP)
            );
        } else {
            result.put("bodyText", new String(bytes, StandardCharsets.UTF_8));
        }
        return result;
    }

    private JSObject headersObject(Headers headers) {
        JSObject result = new JSObject();
        for (String name : headers.names()) {
            result.put(name.toLowerCase(Locale.ROOT), headers.get(name));
        }
        return result;
    }

    private void resolveNetworkFailure(
        PluginCall call,
        Target target,
        IOException error
    ) {
        String pending = preferences.getString(pendingKey(target.profileId), null);
        if (pending != null && error instanceof SSLHandshakeException) {
            try {
                JSONObject details = new JSONObject(pending);
                JSONObject body = new JSONObject().put(
                    "error",
                    new JSONObject()
                        .put("code", "runtime.tls_untrusted")
                        .put(
                            "message",
                            "Confirm the runner certificate before connecting."
                        )
                        .put("details", details)
                );
                call.resolve(new JSObject()
                    .put("status", 495)
                    .put(
                        "headers",
                        new JSObject().put(
                            "content-type",
                            "application/json"
                        )
                    )
                    .put("bodyText", body.toString())
                );
                return;
            } catch (JSONException ignored) {
                // Fall through to a typed, redacted network failure.
            }
        }
        call.reject(
            "The runner could not be reached.",
            "runtime.network_failed",
            error
        );
    }

    private void rejectNetworkFailure(
        PluginCall call,
        Target target,
        IOException error
    ) {
        String pending = preferences.getString(pendingKey(target.profileId), null);
        if (pending != null && error instanceof SSLHandshakeException) {
            try {
                JSONObject details = new JSONObject(pending);
                call.reject(
                    "Confirm the runner certificate before connecting.",
                    "runtime.tls_untrusted",
                    error,
                    new JSObject()
                        .put("origin", details.optString("origin"))
                        .put(
                            "fingerprint",
                            details.optString("fingerprint")
                        )
                );
                return;
            } catch (JSONException ignored) {
                // Fall through to the redacted network error.
            }
        }
        call.reject(
            "The runner could not be reached.",
            "runtime.network_failed",
            error
        );
    }

    private Target parseTarget(PluginCall call) {
        JSObject target = call.getObject("target");
        if (target == null) throw new IllegalArgumentException("Runner target is invalid.");
        String profileId = required(
            target.getString("profileId"),
            "Runner profile id is required."
        );
        String baseUrl = required(
            target.getString("baseUrl"),
            "Runner URL is required."
        ).replaceAll("/+$", "");
        Uri uri = Uri.parse(baseUrl);
        if (uri.getHost() == null) {
            throw new IllegalArgumentException("Runner URL is invalid.");
        }
        validateTransport(uri);
        return new Target(
            profileId,
            baseUrl,
            uri.getHost(),
            target.getString("credentialRef"),
            target.getString("runnerInstanceId")
        );
    }

    private void validateTransport(Uri uri) {
        if ("https".equalsIgnoreCase(uri.getScheme())) return;
        if (
            BuildConfig.DEBUG
                && "http".equalsIgnoreCase(uri.getScheme())
                && Set.of("localhost", "127.0.0.1", "::1").contains(
                    uri.getHost()
                )
        ) {
            return;
        }
        throw new IllegalArgumentException(
            "Mobile runner connections require HTTPS outside local development."
        );
    }

    private String validatedPath(String path) {
        if (path == null || !path.startsWith("/api/") || path.startsWith("//")) {
            throw new IllegalArgumentException("Runner request path is invalid.");
        }
        return path;
    }

    private boolean requiresCredential(String method, String path) {
        return !(
            method.equals("GET")
                && (
                    path.startsWith("/api/auth/session")
                        || path.startsWith("/api/runtime/bootstrap")
                )
        );
    }

    private static String required(String value, String message) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException(message);
        }
        return value;
    }

    private static boolean equalNullable(String left, String right) {
        return left == null ? right == null : left.equals(right);
    }

    private static String pinKey(String profileId, String origin) {
        return "tls.pin." + profileId + "." + origin;
    }

    private static String pendingKey(String profileId) {
        return "tls.pending." + profileId;
    }

    private static String cursorKey(String profileId, String path) {
        return "cursor." + profileId + "." + sha256(path.getBytes(StandardCharsets.UTF_8));
    }

    private static String sha256(byte[] input) {
        try {
            return Base64.encodeToString(
                MessageDigest.getInstance("SHA-256").digest(input),
                Base64.NO_WRAP | Base64.URL_SAFE
            );
        } catch (Exception error) {
            throw new IllegalStateException(error);
        }
    }

    private static X509TrustManager systemTrustManager() throws Exception {
        TrustManagerFactory factory = TrustManagerFactory.getInstance(
            TrustManagerFactory.getDefaultAlgorithm()
        );
        factory.init((KeyStore) null);
        for (TrustManager manager : factory.getTrustManagers()) {
            if (manager instanceof X509TrustManager) {
                return (X509TrustManager) manager;
            }
        }
        throw new IllegalStateException("System trust manager is unavailable.");
    }

    private interface PendingFingerprint {
        void record(String fingerprint);
    }

    private static final class RecordingTrustManager
        implements X509TrustManager {

        private final X509TrustManager system;
        private final String acceptedPin;
        private final PendingFingerprint pending;

        RecordingTrustManager(
            X509TrustManager system,
            String acceptedPin,
            PendingFingerprint pending
        ) {
            this.system = system;
            this.acceptedPin = acceptedPin;
            this.pending = pending;
        }

        @Override
        public void checkClientTrusted(
            X509Certificate[] chain,
            String authType
        ) throws CertificateException {
            system.checkClientTrusted(chain, authType);
        }

        @Override
        public void checkServerTrusted(
            X509Certificate[] chain,
            String authType
        ) throws CertificateException {
            try {
                system.checkServerTrusted(chain, authType);
                return;
            } catch (CertificateException systemFailure) {
                if (chain.length == 0) throw systemFailure;
                String presented = CertificatePinner.pin(chain[0]);
                if (presented.equals(acceptedPin)) return;
                pending.record(presented);
                throw systemFailure;
            }
        }

        @Override
        public X509Certificate[] getAcceptedIssuers() {
            return system.getAcceptedIssuers();
        }
    }

    private static final class Target {
        final String profileId;
        final String baseUrl;
        final String host;
        final String credentialRef;
        final String runnerInstanceId;

        Target(
            String profileId,
            String baseUrl,
            String host,
            String credentialRef,
            String runnerInstanceId
        ) {
            this.profileId = profileId;
            this.baseUrl = baseUrl;
            this.host = host;
            this.credentialRef = credentialRef;
            this.runnerInstanceId = runnerInstanceId;
        }
    }

    private static final class StreamConfiguration {
        final String streamId;
        final Target target;
        final String path;
        volatile String lastEventId;

        StreamConfiguration(
            String streamId,
            Target target,
            String path,
            String lastEventId
        ) {
            this.streamId = streamId;
            this.target = target;
            this.path = path;
            this.lastEventId = lastEventId;
        }
    }

    private static final class NativeCredentialStore {
        private final SharedPreferences preferences;
        private final KeyStore keyStore;

        NativeCredentialStore(
            Context context,
            SharedPreferences preferences
        ) {
            this.preferences = preferences;
            try {
                keyStore = KeyStore.getInstance("AndroidKeyStore");
                keyStore.load(null);
                if (!keyStore.containsAlias(KEY_ALIAS)) {
                    KeyGenerator generator = KeyGenerator.getInstance(
                        "AES",
                        "AndroidKeyStore"
                    );
                    generator.init(new android.security.keystore.KeyGenParameterSpec.Builder(
                        KEY_ALIAS,
                        android.security.keystore.KeyProperties.PURPOSE_ENCRYPT
                            | android.security.keystore.KeyProperties.PURPOSE_DECRYPT
                    )
                        .setBlockModes(
                            android.security.keystore.KeyProperties.BLOCK_MODE_GCM
                        )
                        .setEncryptionPaddings(
                            android.security.keystore.KeyProperties.ENCRYPTION_PADDING_NONE
                        )
                        .build()
                    );
                    generator.generateKey();
                }
            } catch (Exception error) {
                throw new IllegalStateException(
                    "Android secure storage is unavailable.",
                    error
                );
            }
        }

        void save(String handle, JSONObject value) throws Exception {
            SecretKey key = (SecretKey) keyStore.getKey(KEY_ALIAS, null);
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.ENCRYPT_MODE, key);
            byte[] encrypted = cipher.doFinal(
                value.toString().getBytes(StandardCharsets.UTF_8)
            );
            JSONObject envelope = new JSONObject()
                .put(
                    "iv",
                    Base64.encodeToString(cipher.getIV(), Base64.NO_WRAP)
                )
                .put(
                    "ciphertext",
                    Base64.encodeToString(encrypted, Base64.NO_WRAP)
                );
            preferences.edit()
                .putString("credential." + handle, envelope.toString())
                .putString(
                    "credential-profile." + handle,
                    value.getString("profileId")
                )
                .apply();
        }

        JSONObject read(String handle) {
            try {
                String raw = preferences.getString(
                    "credential." + handle,
                    null
                );
                if (raw == null) return null;
                JSONObject envelope = new JSONObject(raw);
                SecretKey key = (SecretKey) keyStore.getKey(KEY_ALIAS, null);
                Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
                cipher.init(
                    Cipher.DECRYPT_MODE,
                    key,
                    new GCMParameterSpec(
                        128,
                        Base64.decode(
                            envelope.getString("iv"),
                            Base64.DEFAULT
                        )
                    )
                );
                byte[] clear = cipher.doFinal(
                    Base64.decode(
                        envelope.getString("ciphertext"),
                        Base64.DEFAULT
                    )
                );
                return new JSONObject(
                    new String(clear, StandardCharsets.UTF_8)
                );
            } catch (Exception error) {
                return null;
            }
        }

        void delete(String handle) {
            preferences.edit()
                .remove("credential." + handle)
                .remove("credential-profile." + handle)
                .apply();
        }

        void clearForProfile(String profileId) {
            if (profileId == null) return;
            Map<String, ?> entries = preferences.getAll();
            SharedPreferences.Editor editor = preferences.edit();
            for (Map.Entry<String, ?> entry : entries.entrySet()) {
                if (
                    entry.getKey().startsWith("credential-profile.")
                        && profileId.equals(entry.getValue())
                ) {
                    String handle = entry.getKey().substring(
                        "credential-profile.".length()
                    );
                    editor.remove("credential." + handle);
                    editor.remove(entry.getKey());
                }
            }
            editor.apply();
        }
    }
}
