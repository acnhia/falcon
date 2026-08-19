package com.falcon.onboarding.web;

import com.falcon.FalconApplication;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(classes = FalconApplication.class)
@AutoConfigureMockMvc
class OnboardingControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    void postApplicationsReturnsPublicReferenceAndDraftStatus() throws Exception {
        mockMvc.perform(post("/api/onboarding/applications"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.publicReference").isNotEmpty())
                .andExpect(jsonPath("$.status").value("DRAFT"));
    }

    @Test
    void getUnknownPublicReferenceReturns404() throws Exception {
        mockMvc.perform(get("/api/onboarding/applications/does-not-exist"))
                .andExpect(status().isNotFound());
    }

    @Test
    void postCaptureLinksReturnsCaptureUrlAndExpiry() throws Exception {
        String response = mockMvc.perform(post("/api/onboarding/applications"))
                .andReturn().getResponse().getContentAsString();
        String publicReference = extractField(response, "publicReference");

        mockMvc.perform(post("/api/onboarding/applications/" + publicReference + "/capture-links"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.captureUrl").value(org.hamcrest.Matchers.containsString("/#/capture/")))
                .andExpect(jsonPath("$.expiresAt").isNotEmpty());
    }

    private static String extractField(String json, String field) {
        String marker = "\"" + field + "\":\"";
        int start = json.indexOf(marker) + marker.length();
        int end = json.indexOf('"', start);
        return json.substring(start, end);
    }
}
