package com.falcon.onboarding.repository;

import com.falcon.onboarding.domain.CaptureToken;

import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Test-only in-memory double for {@link CaptureTokenRepository}. The
 * production bean is {@code JdbcCaptureTokenRepository}.
 */
public class InMemoryCaptureTokenRepository implements CaptureTokenRepository {

    private final Map<String, CaptureToken> byHash = new ConcurrentHashMap<>();

    @Override
    public void save(CaptureToken token) {
        byHash.put(token.tokenHash(), token);
    }

    @Override
    public Optional<CaptureToken> findByHash(String tokenHash) {
        return Optional.ofNullable(byHash.get(tokenHash));
    }
}
