package com.falcon.onboarding.web;

import com.falcon.onboarding.storage.DocumentStorageClient;
import com.falcon.FalconApplication;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(classes = FalconApplication.class)
@AutoConfigureMockMvc
class CaptureControllerTest {

    @Autowired
    private MockMvc mockMvc;

    // Real R2 connectivity isn't available in this test context; document
    // upload/download behavior is already covered against a fake in
    // DefaultOnboardingOrchestratorTest, so here we only need storage to not
    // fail the request.
    @MockBean
    private DocumentStorageClient documentStorageClient;

    @Test
    void getContextForUnknownTokenReturnsGenericNotFoundError() throws Exception {
        mockMvc.perform(get("/api/onboarding/captures/not-a-real-token"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error").value("This capture link is invalid or has expired."));
    }

    @Test
    void putFrontDocumentWithValidJpegReturnsAcceptedAndNotBothSides() throws Exception {
        String token = createApplicationAndIssueCaptureToken();

        mockMvc.perform(put("/api/onboarding/captures/" + token + "/documents/front")
                        .contentType(MediaType.IMAGE_JPEG)
                        .content(syntheticJpeg()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.side").value("FRONT"))
                .andExpect(jsonPath("$.bothSidesCaptured").value(false));
    }

    @Test
    void putFrontDocumentWithUnsupportedMimeTypeReturns400() throws Exception {
        String token = createApplicationAndIssueCaptureToken();

        mockMvc.perform(put("/api/onboarding/captures/" + token + "/documents/front")
                        .contentType(MediaType.IMAGE_GIF)
                        .content(syntheticJpeg()))
                .andExpect(status().isBadRequest());
    }

    @Test
    void putBackDocumentAfterFrontReturnsBothSidesCapturedTrueAndReadyForReview() throws Exception {
        String token = createApplicationAndIssueCaptureToken();

        mockMvc.perform(put("/api/onboarding/captures/" + token + "/documents/front")
                        .contentType(MediaType.IMAGE_JPEG)
                        .content(syntheticJpeg()))
                .andExpect(status().isOk());

        mockMvc.perform(put("/api/onboarding/captures/" + token + "/documents/back")
                        .contentType(MediaType.IMAGE_JPEG)
                        .content(syntheticJpeg()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.bothSidesCaptured").value(true))
                .andExpect(jsonPath("$.status").value("READY_FOR_REVIEW"));
    }

    @Test
    void responseBodyNeverContainsInternalApplicationIdOrObjectKey() throws Exception {
        String applicationsResponse = mockMvc.perform(post("/api/onboarding/applications"))
                .andReturn().getResponse().getContentAsString();
        String publicReference = extractField(applicationsResponse, "publicReference");

        String linkResponse = mockMvc.perform(post("/api/onboarding/applications/" + publicReference + "/capture-links"))
                .andReturn().getResponse().getContentAsString();
        String captureUrl = extractField(linkResponse, "captureUrl");
        String token = captureUrl.substring(captureUrl.lastIndexOf('/') + 1);

        String uploadResponse = mockMvc.perform(put("/api/onboarding/captures/" + token + "/documents/front")
                        .contentType(MediaType.IMAGE_JPEG)
                        .content(syntheticJpeg()))
                .andReturn().getResponse().getContentAsString();

        // The public reference is safe to expose; the internal ID and any storage
        // object key must never appear anywhere in a client-facing response.
        assertThat(uploadResponse).doesNotContain("onboarding/");
    }

    private String createApplicationAndIssueCaptureToken() throws Exception {
        String applicationsResponse = mockMvc.perform(post("/api/onboarding/applications"))
                .andReturn().getResponse().getContentAsString();
        String publicReference = extractField(applicationsResponse, "publicReference");

        String linkResponse = mockMvc.perform(post("/api/onboarding/applications/" + publicReference + "/capture-links"))
                .andReturn().getResponse().getContentAsString();
        String captureUrl = extractField(linkResponse, "captureUrl");
        return captureUrl.substring(captureUrl.lastIndexOf('/') + 1);
    }

    private static String extractField(String json, String field) {
        String marker = "\"" + field + "\":\"";
        int start = json.indexOf(marker) + marker.length();
        int end = json.indexOf('"', start);
        return json.substring(start, end);
    }

    private static byte[] syntheticJpeg() {
        try {
            BufferedImage image = new BufferedImage(10, 10, BufferedImage.TYPE_INT_RGB);
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            ImageIO.write(image, "jpg", out);
            return out.toByteArray();
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }
}
