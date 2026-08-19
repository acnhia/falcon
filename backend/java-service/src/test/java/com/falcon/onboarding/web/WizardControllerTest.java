package com.falcon.onboarding.web;

import com.falcon.FalconApplication;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.util.UUID;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(classes = FalconApplication.class)
@AutoConfigureMockMvc
class WizardControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    void resumingUnknownApplicationReturns404() throws Exception {
        mockMvc.perform(get("/api/onboarding/applications/does-not-exist/resume"))
                .andExpect(status().isNotFound());
    }

    @Test
    void freshApplicationResumesAtActivityOneScreenOne() throws Exception {
        String publicReference = createApplication();

        mockMvc.perform(get("/api/onboarding/applications/" + publicReference + "/resume"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.currentActivityNumber").value(1))
                .andExpect(jsonPath("$.wizardScreen").value(1))
                // Activity 2 ("create or resume") auto-completes on creation (1 of 21 -> rounds to 5%).
                .andExpect(jsonPath("$.completionPercentage").value(5));
    }

    @Test
    void savingDraftThenContinuingReachesPersonalInformationScreen() throws Exception {
        String publicReference = createApplication();
        continueActivity(publicReference, 1);

        mockMvc.perform(put("/api/onboarding/applications/" + publicReference + "/activities/3")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"fields": {"legalFirstName":"Ada","legalLastName":"Lovelace",
                                "dateOfBirth":"1990-01-01","email":"ada@example.test","phone":"555-123-4567",
                                "residentialCountry":"US","residentialAddressLine1":"123 Synthetic St",
                                "residentialCity":"Springfield","residentialState":"IL","residentialPostalCode":"62701",
                                "maritalStatus":"SINGLE","citizenship":"US_CITIZEN",
                                "isBrokerDealerAffiliated":"false","isControlPerson":"false","isPoliticallyExposedPerson":"false",
                                "employmentStatus":"EMPLOYED","annualIncomeRange":"FROM_50K_TO_100K",
                                "netWorthRange":"FROM_50K_TO_100K","liquidNetWorthRange":"FROM_25K_TO_50K",
                                "sourceOfFunds":"EMPLOYMENT_INCOME","investmentObjective":"GROWTH","riskTolerance":"MODERATE",
                                "investmentExperience":"LIMITED","timeHorizon":"LONG_TERM","deliveryPreference":"E_DELIVERY",
                                "w9Certification":"true","esignatureConsent":"true"},
                                "idempotencyKey": "%s"}
                                """.formatted(UUID.randomUUID())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.fieldValues.legalFirstName").value("Ada"));

        mockMvc.perform(post("/api/onboarding/applications/" + publicReference + "/activities/3/continue")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"idempotencyKey\": \"" + UUID.randomUUID() + "\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.currentActivityNumber").value(5));
    }

    @Test
    void continuingActivityThreeWithoutRequiredFieldsReturns400() throws Exception {
        String publicReference = createApplication();
        continueActivity(publicReference, 1);

        mockMvc.perform(post("/api/onboarding/applications/" + publicReference + "/activities/3/continue")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"idempotencyKey\": \"" + UUID.randomUUID() + "\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").isNotEmpty());
    }

    private String createApplication() throws Exception {
        String response = mockMvc.perform(post("/api/onboarding/applications")).andReturn().getResponse().getContentAsString();
        String marker = "\"publicReference\":\"";
        int start = response.indexOf(marker) + marker.length();
        return response.substring(start, response.indexOf('"', start));
    }

    private void continueActivity(String publicReference, int activityNumber) throws Exception {
        mockMvc.perform(post("/api/onboarding/applications/" + publicReference + "/activities/" + activityNumber + "/continue")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"idempotencyKey\": \"" + UUID.randomUUID() + "\"}"));
    }
}
