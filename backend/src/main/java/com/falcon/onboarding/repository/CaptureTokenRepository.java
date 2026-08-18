package com.falcon.onboarding.repository;

import com.falcon.onboarding.domain.CaptureToken;

import java.util.Optional;

public interface CaptureTokenRepository {
    void save(CaptureToken token);

    Optional<CaptureToken> findByHash(String tokenHash);
}
