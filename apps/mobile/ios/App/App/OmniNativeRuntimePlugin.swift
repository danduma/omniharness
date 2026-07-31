import Capacitor
import CryptoKit
import Foundation
import Security
import UIKit
import UserNotifications

private struct RunnerTarget {
    let profileId: String
    let baseURL: URL
    let credentialRef: String?
    let runnerInstanceId: String?
}

private struct CredentialRecord: Codable {
    var profileId: String
    var origin: String
    var runnerInstanceId: String?
    var token: String
    var createdAt: String
}

private struct StreamConfiguration {
    let streamId: String
    let target: RunnerTarget
    let path: String
    var lastEventId: String?
}

private enum NativeRuntimeError: LocalizedError {
    case invalid(String)
    case unauthorized
    case transport(String)

    var errorDescription: String? {
        switch self {
        case .invalid(let message), .transport(let message):
            return message
        case .unauthorized:
            return "Runner authorization is required."
        }
    }
}

private final class KeychainCredentialStore {
    private let service = "dev.omniharness.mobile.runner-session"

    func save(_ record: CredentialRecord, handle: String) throws {
        let data = try JSONEncoder().encode(record)
        delete(handle)
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: handle,
            kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly,
            kSecValueData as String: data
        ]
        let status = SecItemAdd(query as CFDictionary, nil)
        guard status == errSecSuccess else {
            throw NativeRuntimeError.transport("Keychain write failed (\(status)).")
        }
    }

    func read(_ handle: String) -> CredentialRecord? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: handle,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne
        ]
        var item: CFTypeRef?
        guard SecItemCopyMatching(query as CFDictionary, &item) == errSecSuccess,
              let data = item as? Data else {
            return nil
        }
        return try? JSONDecoder().decode(CredentialRecord.self, from: data)
    }

    func delete(_ handle: String) {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: handle
        ]
        SecItemDelete(query as CFDictionary)
    }
}

private enum RunnerTrust {
    static func fingerprint(_ trust: SecTrust) -> String? {
        guard let certificate = SecTrustGetCertificateAtIndex(trust, 0),
              let publicKey = SecCertificateCopyKey(certificate),
              let keyData = SecKeyCopyExternalRepresentation(publicKey, nil) as Data? else {
            return nil
        }
        return "sha256/" + Data(SHA256.hash(data: keyData)).base64EncodedString()
    }

    static func pinKey(profileId: String, origin: String) -> String {
        "omniharness.mobile.tls.pin.\(profileId).\(origin)"
    }

    static func pendingKey(profileId: String) -> String {
        "omniharness.mobile.tls.pending.\(profileId)"
    }

    static func evaluate(
        challenge: URLAuthenticationChallenge,
        profileId: String,
        origin: String
    ) -> (URLSession.AuthChallengeDisposition, URLCredential?) {
        guard challenge.protectionSpace.authenticationMethod
                == NSURLAuthenticationMethodServerTrust,
              let trust = challenge.protectionSpace.serverTrust else {
            return (.performDefaultHandling, nil)
        }
        var trustError: CFError?
        if SecTrustEvaluateWithError(trust, &trustError) {
            return (.useCredential, URLCredential(trust: trust))
        }
        guard let fingerprint = fingerprint(trust) else {
            return (.cancelAuthenticationChallenge, nil)
        }
        let stored = UserDefaults.standard.string(
            forKey: pinKey(profileId: profileId, origin: origin)
        )
        if stored == fingerprint {
            return (.useCredential, URLCredential(trust: trust))
        }
        UserDefaults.standard.set([
            "origin": origin,
            "fingerprint": fingerprint
        ], forKey: pendingKey(profileId: profileId))
        return (.cancelAuthenticationChallenge, nil)
    }
}

private final class RunnerSessionDelegate: NSObject, URLSessionDelegate {
    let profileId: String
    let origin: String

    init(profileId: String, origin: String) {
        self.profileId = profileId
        self.origin = origin
    }

    func urlSession(
        _ session: URLSession,
        didReceive challenge: URLAuthenticationChallenge,
        completionHandler: @escaping (
            URLSession.AuthChallengeDisposition,
            URLCredential?
        ) -> Void
    ) {
        let result = RunnerTrust.evaluate(
            challenge: challenge,
            profileId: profileId,
            origin: origin
        )
        completionHandler(result.0, result.1)
    }
}

private final class RunnerStreamDelegate: NSObject, URLSessionDataDelegate {
    let profileId: String
    let origin: String
    let streamId: String
    let onFrame: ([String: Any]) -> Void
    let onClosed: (Error?) -> Void
    private var buffer = ""

    init(
        profileId: String,
        origin: String,
        streamId: String,
        onFrame: @escaping ([String: Any]) -> Void,
        onClosed: @escaping (Error?) -> Void
    ) {
        self.profileId = profileId
        self.origin = origin
        self.streamId = streamId
        self.onFrame = onFrame
        self.onClosed = onClosed
    }

    func urlSession(
        _ session: URLSession,
        didReceive challenge: URLAuthenticationChallenge,
        completionHandler: @escaping (
            URLSession.AuthChallengeDisposition,
            URLCredential?
        ) -> Void
    ) {
        let result = RunnerTrust.evaluate(
            challenge: challenge,
            profileId: profileId,
            origin: origin
        )
        completionHandler(result.0, result.1)
    }

    func urlSession(
        _ session: URLSession,
        dataTask: URLSessionDataTask,
        didReceive data: Data
    ) {
        buffer += String(decoding: data, as: UTF8.self)
        buffer = buffer.replacingOccurrences(of: "\r\n", with: "\n")
        while let range = buffer.range(of: "\n\n") {
            let raw = String(buffer[..<range.lowerBound])
            buffer.removeSubrange(..<range.upperBound)
            if let frame = parseFrame(raw) {
                onFrame(frame)
            }
        }
    }

    func urlSession(
        _ session: URLSession,
        task: URLSessionTask,
        didCompleteWithError error: Error?
    ) {
        onClosed(error)
    }

    private func parseFrame(_ raw: String) -> [String: Any]? {
        var event = "message"
        var data: [String] = []
        var cursor: String?
        for line in raw.split(separator: "\n", omittingEmptySubsequences: false) {
            if line.hasPrefix(":") { continue }
            let text = String(line)
            if text.hasPrefix("event:") {
                event = String(text.dropFirst(6)).trimmingCharacters(in: .whitespaces)
            } else if text.hasPrefix("data:") {
                data.append(String(text.dropFirst(5)).trimmingCharacters(in: .whitespaces))
            } else if text.hasPrefix("id:") {
                cursor = String(text.dropFirst(3)).trimmingCharacters(in: .whitespaces)
            }
        }
        guard !data.isEmpty else { return nil }
        var result: [String: Any] = [
            "streamId": streamId,
            "type": event,
            "data": data.joined(separator: "\n")
        ]
        if let cursor, !cursor.isEmpty {
            result["lastEventId"] = cursor
        }
        return result
    }
}

@objc(OmniNativeRuntimePlugin)
public class OmniNativeRuntimePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "OmniNativeRuntimePlugin"
    public let jsName = "OmniNativeRuntime"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "request", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "cancelRequest", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "authorize", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "credential", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "confirmTls", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "openStream", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "closeStream", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "openExternal", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "notify", returnType: CAPPluginReturnPromise)
    ]

    private let credentials = KeychainCredentialStore()
    private let stateQueue = DispatchQueue(
        label: "dev.omniharness.mobile.native-runtime"
    )
    private let maxQueuedFrames = 256
    private let maxQueuedBytes = 1_048_576
    private var queuedFrames = 0
    private var queuedBytes = 0
    private var streamConfigurations: [String: StreamConfiguration] = [:]
    private var requestTasks: [String: URLSessionDataTask] = [:]
    private var streamSessions: [String: URLSession] = [:]
    private var streamDelegates: [String: RunnerStreamDelegate] = [:]
    private var isSuspended = false

    @objc override public func load() {
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(didEnterBackground),
            name: UIApplication.didEnterBackgroundNotification,
            object: nil
        )
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(willEnterForeground),
            name: UIApplication.willEnterForegroundNotification,
            object: nil
        )
    }

    deinit {
        NotificationCenter.default.removeObserver(self)
    }

    @objc func request(_ call: CAPPluginCall) {
        do {
            let target = try parseTarget(call)
            let requestId = try requiredString(call, "requestId")
            let path = try validatedPath(call.getString("path"))
            let method = (call.getString("method") ?? "GET").uppercased()
            let request = try makeRequest(
                target: target,
                path: path,
                method: method,
                headers: stringDictionary(call.getObject("headers")),
                bodyText: call.getString("bodyText"),
                formData: call.getArray("formData"),
                requireCredential: requiresCredential(method: method, path: path)
            )
            perform(
                request: request,
                target: target,
                requestId: requestId,
                responseType: call.getString("responseType"),
                call: call
            )
        } catch {
            call.reject(error.localizedDescription, "runtime.native_invalid", error)
        }
    }

    @objc func cancelRequest(_ call: CAPPluginCall) {
        guard let requestId = call.getString("requestId") else {
            call.reject("Request id is required.", "runtime.request_invalid")
            return
        }
        stateQueue.sync {
            requestTasks.removeValue(forKey: requestId)?.cancel()
        }
        call.resolve(["ok": true])
    }

    @objc func authorize(_ call: CAPPluginCall) {
        do {
            let target = try parseTarget(call)
            guard let password = call.getString("password"), !password.isEmpty else {
                throw NativeRuntimeError.invalid("Runner password is required.")
            }
            let label = call.getString("clientLabel") ?? "OmniHarness iOS"
            let body = try JSONSerialization.data(withJSONObject: [
                "password": password,
                "tokenTransport": "bearer",
                "clientLabel": label
            ])
            var request = try makeRequest(
                target: target,
                path: "/api/auth/login",
                method: "POST",
                headers: ["content-type": "application/json"],
                bodyText: String(decoding: body, as: UTF8.self),
                formData: nil,
                requireCredential: false
            )
            request.cachePolicy = .reloadIgnoringLocalAndRemoteCacheData
            let delegate = RunnerSessionDelegate(
                profileId: target.profileId,
                origin: target.baseURL.absoluteString
            )
            let session = URLSession(
                configuration: .ephemeral,
                delegate: delegate,
                delegateQueue: nil
            )
            session.dataTask(with: request) { [weak self] data, response, error in
                defer { session.finishTasksAndInvalidate() }
                guard let self else { return }
                if let error {
                    self.rejectTransportFailure(
                        target: target,
                        error: error,
                        call: call
                    )
                    return
                }
                guard let http = response as? HTTPURLResponse,
                      let data,
                      let object = try? JSONSerialization.jsonObject(with: data)
                        as? [String: Any],
                      (200..<300).contains(http.statusCode),
                      let token = object["token"] as? String else {
                    call.reject("Runner login failed.", "runtime.login_failed")
                    return
                }
                do {
                    let handle = "mobile-\(UUID().uuidString.lowercased())"
                    try self.credentials.save(CredentialRecord(
                        profileId: target.profileId,
                        origin: target.baseURL.absoluteString,
                        runnerInstanceId: target.runnerInstanceId,
                        token: token,
                        createdAt: ISO8601DateFormatter().string(from: Date())
                    ), handle: handle)
                    call.resolve(["credentialRef": handle])
                } catch {
                    call.reject(
                        error.localizedDescription,
                        "runtime.credential_store_failed",
                        error
                    )
                }
            }.resume()
        } catch {
            call.reject(error.localizedDescription, "runtime.native_invalid", error)
        }
    }

    @objc func credential(_ call: CAPPluginCall) {
        let command = call.getString("command") ?? ""
        let payload = call.getObject("payload") ?? [:]
        let handle = payload["handle"] as? String
        switch command {
        case "metadata":
            guard let handle, let record = credentials.read(handle) else {
                call.resolve(["value": NSNull()])
                return
            }
            call.resolve(["value": [
                "profileId": record.profileId,
                "origin": record.origin,
                "runnerInstanceId": record.runnerInstanceId as Any,
                "createdAt": record.createdAt
            ]])
        case "rebind":
            guard let handle,
                  var record = credentials.read(handle),
                  let binding = payload["binding"] as? [String: Any],
                  let origin = binding["origin"] as? String else {
                call.reject("Credential handle is invalid.", "runtime.credential_invalid")
                return
            }
            record.origin = origin
            record.runnerInstanceId = binding["runnerInstanceId"] as? String
            do {
                try credentials.save(record, handle: handle)
                call.resolve()
            } catch {
                call.reject(error.localizedDescription, "runtime.credential_store_failed", error)
            }
        case "clear":
            if let handle { credentials.delete(handle) }
            call.resolve()
        case "clearForProfile":
            // Handles are intentionally opaque; the WebView clears known handles one by one.
            call.resolve()
        default:
            call.reject("Unknown credential command.", "runtime.credential_command_invalid")
        }
    }

    @objc func confirmTls(_ call: CAPPluginCall) {
        guard let profileId = call.getString("profileId"),
              let origin = call.getString("origin"),
              let fingerprint = call.getString("fingerprint"),
              let pending = UserDefaults.standard.dictionary(
                forKey: RunnerTrust.pendingKey(profileId: profileId)
              ),
              pending["origin"] as? String == origin,
              pending["fingerprint"] as? String == fingerprint else {
            call.reject(
                "The certificate no longer matches the pending confirmation.",
                "runtime.tls_confirmation_stale"
            )
            return
        }
        UserDefaults.standard.set(
            fingerprint,
            forKey: RunnerTrust.pinKey(profileId: profileId, origin: origin)
        )
        UserDefaults.standard.removeObject(
            forKey: RunnerTrust.pendingKey(profileId: profileId)
        )
        call.resolve(["ok": true])
    }

    @objc func openStream(_ call: CAPPluginCall) {
        do {
            let streamId = try requiredString(call, "streamId")
            let target = try parseTarget(call)
            let path = try validatedPath(call.getString("path"))
            let persistedCursor = UserDefaults.standard.string(
                forKey: cursorKey(profileId: target.profileId, path: path)
            )
            let configuration = StreamConfiguration(
                streamId: streamId,
                target: target,
                path: path,
                lastEventId: call.getString("lastEventId") ?? persistedCursor
            )
            stateQueue.sync {
                streamConfigurations[streamId] = configuration
                if !isSuspended {
                    startStream(configuration)
                }
            }
            call.resolve(["ok": true])
        } catch {
            call.reject(error.localizedDescription, "runtime.stream_invalid", error)
        }
    }

    @objc func closeStream(_ call: CAPPluginCall) {
        guard let streamId = call.getString("streamId") else {
            call.reject("Stream id is required.", "runtime.stream_invalid")
            return
        }
        stateQueue.sync {
            streamConfigurations.removeValue(forKey: streamId)
            stopStream(streamId)
        }
        call.resolve(["ok": true])
    }

    @objc func openExternal(_ call: CAPPluginCall) {
        guard let raw = call.getString("url"),
              let url = URL(string: raw),
              ["https", "http", "mailto"].contains(url.scheme?.lowercased() ?? "") else {
            call.reject("External URL is invalid.", "runtime.external_url_invalid")
            return
        }
        DispatchQueue.main.async {
            UIApplication.shared.open(url) { opened in
                opened
                    ? call.resolve(["ok": true])
                    : call.reject("The URL could not be opened.", "runtime.external_open_failed")
            }
        }
    }

    @objc func notify(_ call: CAPPluginCall) {
        guard let title = call.getString("title"), !title.isEmpty else {
            call.reject("Notification title is required.", "runtime.notification_invalid")
            return
        }
        let center = UNUserNotificationCenter.current()
        center.requestAuthorization(options: [.alert, .sound]) { granted, error in
            if let error {
                call.reject(error.localizedDescription, "runtime.notification_failed", error)
                return
            }
            guard granted else {
                call.resolve(["ok": false])
                return
            }
            let content = UNMutableNotificationContent()
            content.title = title
            content.body = call.getString("body") ?? ""
            let request = UNNotificationRequest(
                identifier: UUID().uuidString,
                content: content,
                trigger: nil
            )
            center.add(request) { error in
                if let error {
                    call.reject(error.localizedDescription, "runtime.notification_failed", error)
                } else {
                    call.resolve(["ok": true])
                }
            }
        }
    }

    @objc private func didEnterBackground() {
        stateQueue.async {
            self.isSuspended = true
            for streamId in self.streamSessions.keys {
                self.stopStream(streamId)
            }
        }
    }

    @objc private func willEnterForeground() {
        stateQueue.async {
            self.isSuspended = false
            for configuration in self.streamConfigurations.values {
                self.startStream(configuration)
            }
        }
    }

    private func startStream(_ configuration: StreamConfiguration) {
        stopStream(configuration.streamId)
        do {
            var request = try makeRequest(
                target: configuration.target,
                path: configuration.path,
                method: "GET",
                headers: ["accept": "text/event-stream"],
                bodyText: nil,
                formData: nil,
                requireCredential: true
            )
            if let cursor = configuration.lastEventId, !cursor.isEmpty {
                request.setValue(cursor, forHTTPHeaderField: "Last-Event-ID")
            }
            let delegate = RunnerStreamDelegate(
                profileId: configuration.target.profileId,
                origin: configuration.target.baseURL.absoluteString,
                streamId: configuration.streamId,
                onFrame: { [weak self] frame in
                    self?.enqueueFrame(frame, configuration: configuration)
                },
                onClosed: { [weak self] error in
                    guard let self, error != nil else { return }
                    self.stateQueue.asyncAfter(deadline: .now() + 1.0) {
                        guard !self.isSuspended,
                              let current = self.streamConfigurations[
                                configuration.streamId
                              ] else { return }
                        self.startStream(current)
                    }
                }
            )
            let session = URLSession(
                configuration: .ephemeral,
                delegate: delegate,
                delegateQueue: nil
            )
            streamDelegates[configuration.streamId] = delegate
            streamSessions[configuration.streamId] = session
            session.dataTask(with: request).resume()
        } catch {
            enqueueFrame([
                "streamId": configuration.streamId,
                "type": "error",
                "data": jsonString([
                    "code": "runtime.stream_failed",
                    "message": error.localizedDescription
                ])
            ], configuration: configuration)
        }
    }

    private func stopStream(_ streamId: String) {
        streamSessions.removeValue(forKey: streamId)?.invalidateAndCancel()
        streamDelegates.removeValue(forKey: streamId)
    }

    private func enqueueFrame(
        _ frame: [String: Any],
        configuration: StreamConfiguration
    ) {
        stateQueue.async {
            let byteCount = (frame["data"] as? String)?.utf8.count ?? 0
            guard self.queuedFrames < self.maxQueuedFrames,
                  self.queuedBytes + byteCount <= self.maxQueuedBytes else {
                self.stopStream(configuration.streamId)
                return
            }
            self.queuedFrames += 1
            self.queuedBytes += byteCount
            if let cursor = frame["lastEventId"] as? String {
                var updated = configuration
                updated.lastEventId = cursor
                self.streamConfigurations[configuration.streamId] = updated
                UserDefaults.standard.set(
                    cursor,
                    forKey: self.cursorKey(
                        profileId: configuration.target.profileId,
                        path: configuration.path
                    )
                )
            }
            DispatchQueue.main.async {
                self.notifyListeners("streamFrame", data: frame)
                self.stateQueue.async {
                    self.queuedFrames = max(0, self.queuedFrames - 1)
                    self.queuedBytes = max(0, self.queuedBytes - byteCount)
                }
            }
        }
    }

    private func perform(
        request: URLRequest,
        target: RunnerTarget,
        requestId: String,
        responseType: String?,
        call: CAPPluginCall
    ) {
        let delegate = RunnerSessionDelegate(
            profileId: target.profileId,
            origin: target.baseURL.absoluteString
        )
        let session = URLSession(
            configuration: .ephemeral,
            delegate: delegate,
            delegateQueue: nil
        )
        let task = session.dataTask(with: request) { [weak self] data, response, error in
            defer { session.finishTasksAndInvalidate() }
            guard let self else { return }
            self.stateQueue.async {
                self.requestTasks.removeValue(forKey: requestId)
            }
            if let error {
                self.resolveTransportFailure(target: target, error: error, call: call)
                return
            }
            guard let http = response as? HTTPURLResponse else {
                call.reject("Runner response was invalid.", "runtime.response_invalid")
                return
            }
            var headers: [String: String] = [:]
            for (key, value) in http.allHeaderFields {
                headers[String(describing: key).lowercased()] = String(describing: value)
            }
            var result: [String: Any] = [
                "status": http.statusCode,
                "headers": headers
            ]
            let body = data ?? Data()
            if responseType == "blob" || responseType == "arrayBuffer" {
                result["bodyBase64"] = body.base64EncodedString()
            } else {
                result["bodyText"] = String(decoding: body, as: UTF8.self)
            }
            call.resolve(result)
        }
        stateQueue.sync {
            requestTasks[requestId]?.cancel()
            requestTasks[requestId] = task
        }
        task.resume()
    }

    private func resolveTransportFailure(
        target: RunnerTarget,
        error: Error,
        call: CAPPluginCall
    ) {
        if let pending = UserDefaults.standard.dictionary(
            forKey: RunnerTrust.pendingKey(profileId: target.profileId)
        ), let fingerprint = pending["fingerprint"] as? String {
            call.resolve([
                "status": 495,
                "headers": ["content-type": "application/json"],
                "bodyText": jsonString([
                    "error": [
                        "code": "runtime.tls_untrusted",
                        "message": "Confirm the runner certificate before connecting.",
                        "details": [
                            "origin": target.baseURL.absoluteString,
                            "fingerprint": fingerprint
                        ]
                    ]
                ])
            ])
            return
        }
        call.reject(error.localizedDescription, "runtime.network_failed", error)
    }

    private func rejectTransportFailure(
        target: RunnerTarget,
        error: Error,
        call: CAPPluginCall
    ) {
        if let pending = UserDefaults.standard.dictionary(
            forKey: RunnerTrust.pendingKey(profileId: target.profileId)
        ), let fingerprint = pending["fingerprint"] as? String {
            call.reject(
                "Confirm the runner certificate before connecting.",
                "runtime.tls_untrusted",
                error,
                [
                    "origin": target.baseURL.absoluteString,
                    "fingerprint": fingerprint
                ]
            )
            return
        }
        call.reject(error.localizedDescription, "runtime.network_failed", error)
    }

    private func makeRequest(
        target: RunnerTarget,
        path: String,
        method: String,
        headers: [String: String],
        bodyText: String?,
        formData: [JSValue]?,
        requireCredential: Bool
    ) throws -> URLRequest {
        guard ["GET", "POST", "PUT", "PATCH", "DELETE"].contains(method) else {
            throw NativeRuntimeError.invalid("HTTP method is not allowed.")
        }
        guard let url = URL(string: path, relativeTo: target.baseURL)?.absoluteURL,
              url.host == target.baseURL.host else {
            throw NativeRuntimeError.invalid("Runner request path is invalid.")
        }
        try validateTransport(url)
        var request = URLRequest(url: url)
        request.httpMethod = method
        request.timeoutInterval = 30
        for (key, value) in headers where !isSensitiveRendererHeader(key) {
            request.setValue(value, forHTTPHeaderField: key)
        }
        if requireCredential {
            guard let handle = target.credentialRef,
                  let record = credentials.read(handle),
                  record.profileId == target.profileId,
                  record.origin == target.baseURL.absoluteString,
                  record.runnerInstanceId == target.runnerInstanceId else {
                throw NativeRuntimeError.unauthorized
            }
            request.setValue("Bearer \(record.token)", forHTTPHeaderField: "Authorization")
        }
        if let formData {
            let boundary = "OmniHarness-\(UUID().uuidString)"
            request.setValue(
                "multipart/form-data; boundary=\(boundary)",
                forHTTPHeaderField: "content-type"
            )
            request.httpBody = multipartBody(formData, boundary: boundary)
        } else if let bodyText {
            request.httpBody = bodyText.data(using: .utf8)
        }
        return request
    }

    private func multipartBody(_ entries: [JSValue], boundary: String) -> Data {
        var output = Data()
        for value in entries {
            guard let entry = value as? [String: Any],
                  let name = entry["name"] as? String else { continue }
            output.append("--\(boundary)\r\n".data(using: .utf8)!)
            if let text = entry["value"] as? String {
                output.append(
                    "Content-Disposition: form-data; name=\"\(name)\"\r\n\r\n"
                        .data(using: .utf8)!
                )
                output.append(text.data(using: .utf8)!)
            } else if let file = entry["file"] as? [String: Any],
                      let filename = file["name"] as? String,
                      let base64 = file["base64"] as? String,
                      let data = Data(base64Encoded: base64) {
                let type = file["type"] as? String ?? "application/octet-stream"
                output.append(
                    "Content-Disposition: form-data; name=\"\(name)\"; filename=\"\(filename)\"\r\n"
                        .data(using: .utf8)!
                )
                output.append("Content-Type: \(type)\r\n\r\n".data(using: .utf8)!)
                output.append(data)
            }
            output.append("\r\n".data(using: .utf8)!)
        }
        output.append("--\(boundary)--\r\n".data(using: .utf8)!)
        return output
    }

    private func parseTarget(_ call: CAPPluginCall) throws -> RunnerTarget {
        guard let target = call.getObject("target"),
              let profileId = target["profileId"] as? String,
              let rawURL = target["baseUrl"] as? String,
              let baseURL = URL(string: rawURL),
              baseURL.host != nil else {
            throw NativeRuntimeError.invalid("Runner target is invalid.")
        }
        try validateTransport(baseURL)
        return RunnerTarget(
            profileId: profileId,
            baseURL: baseURL,
            credentialRef: target["credentialRef"] as? String,
            runnerInstanceId: target["runnerInstanceId"] as? String
        )
    }

    private func validateTransport(_ url: URL) throws {
        if url.scheme?.lowercased() == "https" { return }
#if DEBUG
        if url.scheme?.lowercased() == "http",
           ["localhost", "127.0.0.1", "::1"].contains(url.host?.lowercased() ?? "") {
            return
        }
#endif
        throw NativeRuntimeError.invalid(
            "Mobile runner connections require HTTPS outside local development."
        )
    }

    private func validatedPath(_ path: String?) throws -> String {
        guard let path, path.hasPrefix("/api/"), !path.hasPrefix("//") else {
            throw NativeRuntimeError.invalid("Runner request path is invalid.")
        }
        return path
    }

    private func requiresCredential(method: String, path: String) -> Bool {
        if method == "GET",
           path.hasPrefix("/api/auth/session")
            || path.hasPrefix("/api/runtime/bootstrap") {
            return false
        }
        return true
    }

    private func requiredString(
        _ call: CAPPluginCall,
        _ key: String
    ) throws -> String {
        guard let value = call.getString(key), !value.isEmpty else {
            throw NativeRuntimeError.invalid("\(key) is required.")
        }
        return value
    }

    private func stringDictionary(_ value: JSObject?) -> [String: String] {
        guard let value else { return [:] }
        return value.reduce(into: [:]) { output, item in
            if let string = item.value as? String {
                output[item.key] = string
            }
        }
    }

    private func isSensitiveRendererHeader(_ header: String) -> Bool {
        ["authorization", "cookie", "origin", "host"].contains(header.lowercased())
    }

    private func cursorKey(profileId: String, path: String) -> String {
        let digest = SHA256.hash(data: Data(path.utf8))
        return "omniharness.mobile.cursor.\(profileId).\(digest.hex)"
    }

    private func jsonString(_ value: Any) -> String {
        guard JSONSerialization.isValidJSONObject(value),
              let data = try? JSONSerialization.data(withJSONObject: value) else {
            return "{}"
        }
        return String(decoding: data, as: UTF8.self)
    }
}

private extension Digest {
    var hex: String {
        map { String(format: "%02x", $0) }.joined()
    }
}
