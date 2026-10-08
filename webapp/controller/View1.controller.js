sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageBox",
    "sap/m/MessageToast"
], (Controller, JSONModel, MessageBox, MessageToast) => {
    "use strict";

    return Controller.extend("vpapricing.controller.View1", {
        onInit() {
            // Selection field model
            const oViewModel = new JSONModel({
                region: "",
                orderType: "",
                models: [],
                availableModels: [],
                status: "ACTIVE",
                effectiveDate: "",
                submitterEmail: ""
            });

            this.getView().setModel(oViewModel, "viewModel");

            // Pricing table model
            const oPricingModel = new JSONModel({
                results: [],
                resultsCount: 0
            });

            this.getView().setModel(oPricingModel, "pricingModel");
        },
        onClear() {

            const oViewModel =
                this.getView().getModel("viewModel");

            const oPricingModel =
                this.getView().getModel("pricingModel");

            // Clear selection fields
            oViewModel.setData({
                region: "",
                orderType: "",
                models: [],
                availableModels: [],
                status: "ACTIVE",
                effectiveDate: "",
                submitterEmail: ""
            });

            // Clear pricing table
            oPricingModel.setData({
                results: [],
                resultsCount: 0
            });

            // Clear table selection
            const oTable = this.byId("pricingTable");

            if (oTable) {
                oTable.clearSelection();
            }
        },
        async onOrderTypeChange(oEvent) {

            const sOrderType = oEvent.getSource().getSelectedKey();

            const oViewModel = this.getView().getModel("viewModel");

            // Clear previously selected models
            oViewModel.setProperty("/models", []);
            oViewModel.setProperty("/availableModels", []);

            try {

                const oModel = this.getView().getModel();

                const aModels = await this._readEntity(
                    oModel,
                    "/Models"
                );

                let aFilteredModels = [];

                if (sOrderType === "MTS") {

                    aFilteredModels = aModels.filter(function (oModelData) {
                        return oModelData.orderType === "MTS";
                    });

                } else if (sOrderType === "MTO") {

                    aFilteredModels = aModels.filter(function (oModelData) {
                        return oModelData.orderType === "MTO";
                    });

                } else if (sOrderType === "EV") {

                    aFilteredModels = aModels.filter(function (oModelData) {
                        return oModelData.engineType === "EV";
                    });

                } else if (sOrderType === "GEM") {

                    // GeM uses approved MTS pricing,
                    // so models should come from MTS models
                    aFilteredModels = aModels.filter(function (oModelData) {
                        return oModelData.orderType === "MTS";
                    });

                } else if (sOrderType === "CSD") {

                    // CSD is based on approved MTS pricing
                    aFilteredModels = aModels.filter(function (oModelData) {
                        return oModelData.orderType === "MTS";
                    });
                }

                oViewModel.setProperty(
                    "/availableModels",
                    aFilteredModels
                );

                console.log(
                    "Order Type:",
                    sOrderType,
                    "Available Models:",
                    aFilteredModels
                );

            } catch (oError) {

                console.error(
                    "Failed to load models:",
                    oError
                );

                MessageBox.error(
                    "Failed to load models."
                );
            }
        },
        _readEntity: function (
            oModel,
            sPath
        ) {

            return new Promise(
                function (resolve, reject) {

                    const oListBinding =
                        oModel.bindList(sPath);


                    oListBinding
                        .requestContexts(0, 1000)
                        .then(
                            function (aContexts) {

                                const aData =
                                    aContexts.map(
                                        function (oContext) {

                                            return oContext.getObject();

                                        }
                                    );

                                resolve(aData);
                            }
                        )
                        .catch(
                            function (oError) {

                                reject(oError);

                            }
                        );
                }
            );
        },
        onGetData: async function () {

            const oViewModel = this.getView().getModel("viewModel");
            const oPricingModel = this.getView().getModel("pricingModel");
            const oModel = this.getView().getModel();

            const sRegion = oViewModel.getProperty("/region");
            const sOrderType = oViewModel.getProperty("/orderType");
            const aSelectedModels = oViewModel.getProperty("/models") || [];
            const sStatus = oViewModel.getProperty("/status");
            const sEffectiveDate = oViewModel.getProperty("/effectiveDate");

            console.log("Region:", sRegion);
            console.log("Order Type:", sOrderType);
            console.log("Selected Models:", aSelectedModels);
            console.log("Status:", sStatus);
            console.log("Effective Date:", sEffectiveDate);

            // ---------------------------------------------------------
            // 1. Basic validation
            // ---------------------------------------------------------

            if (!sOrderType) {
                MessageBox.warning("Please select Order Type.");
                return;
            }

            if (!aSelectedModels.length) {
                MessageBox.warning("Please select at least one model.");
                return;
            }

            // GeM does not require region
            if (sOrderType !== "GEM" && !sRegion) {
                MessageBox.warning("Please select Region.");
                return;
            }

            try {

                // ---------------------------------------------------------
                // 2. Read all required entities
                // ---------------------------------------------------------

                const [
                    aModels,
                    aPricingComponents,
                    aRTOMasters,
                    aRTOExpenses,
                    aPricingResults
                ] = await Promise.all([

                    this._readEntity(
                        oModel,
                        "/Models"
                    ),

                    this._readEntity(
                        oModel,
                        "/PricingComponents"
                    ),

                    this._readEntity(
                        oModel,
                        "/RTOMasters"
                    ),

                    this._readEntity(
                        oModel,
                        "/RTOExpense"
                    ),

                    this._readEntity(
                        oModel,
                        "/PricingResults"
                    )
                ]);

                console.log("Models:", aModels);
                console.log("Pricing Components:", aPricingComponents);
                console.log("RTO Masters:", aRTOMasters);
                console.log("RTO Expenses:", aRTOExpenses);
                console.log("Pricing Results:", aPricingResults);

                // ---------------------------------------------------------
                // 3. Filter selected models
                // ---------------------------------------------------------

                let aFilteredModels = aModels.filter(function (oModelData) {

                    return aSelectedModels.includes(
                        oModelData.modelCode
                    );

                });

                console.log(
                    "Models after Model filter:",
                    aFilteredModels
                );

                // ---------------------------------------------------------
                // 4. Status filter
                // ---------------------------------------------------------

                aFilteredModels = aFilteredModels.filter(
                    function (oModelData) {

                        const bStatusMatched =
                            sStatus === "ALL" ||
                            !sStatus ||
                            String(oModelData.status).toUpperCase() ===
                            String(sStatus).toUpperCase();

                        console.log("Status Check:", {
                            modelCode: oModelData.modelCode,
                            backendStatus: oModelData.status,
                            selectedStatus: sStatus,
                            matched: bStatusMatched
                        });

                        return bStatusMatched;
                    }
                );

                console.log(
                    "Models after Model + Status filter:",
                    aFilteredModels
                );

                // ---------------------------------------------------------
                // 5. Parse Effective Date
                // ---------------------------------------------------------

                let oSelectedDate = null;

                if (sEffectiveDate) {

                    if (sEffectiveDate.includes(".")) {

                        // DD.MM.YYYY
                        const aDateParts =
                            sEffectiveDate.split(".");

                        const nDay =
                            Number(aDateParts[0]);

                        const nMonth =
                            Number(aDateParts[1]) - 1;

                        const nYear =
                            Number(aDateParts[2]);

                        oSelectedDate =
                            new Date(
                                nYear,
                                nMonth,
                                nDay
                            );

                    } else {

                        oSelectedDate =
                            new Date(sEffectiveDate);
                    }
                }

                console.log(
                    "Parsed Effective Date:",
                    oSelectedDate
                );

                // ---------------------------------------------------------
                // 6. Effective Date filter
                // ---------------------------------------------------------

                if (
                    oSelectedDate &&
                    !isNaN(oSelectedDate.getTime())
                ) {

                    aFilteredModels =
                        aFilteredModels.filter(
                            function (oModelData) {

                                if (!oModelData.validFrom) {
                                    return true;
                                }

                                const oValidFrom =
                                    new Date(
                                        oModelData.validFrom
                                    );

                                const bDateMatched =
                                    oValidFrom <= oSelectedDate;

                                console.log(
                                    "Effective Date Check:",
                                    {
                                        modelCode:
                                            oModelData.modelCode,

                                        validFrom:
                                            oModelData.validFrom,

                                        selectedDate:
                                            oSelectedDate,

                                        matched:
                                            bDateMatched
                                    }
                                );

                                return bDateMatched;
                            }
                        );
                }

                console.log(
                    "Models after Effective Date filter:",
                    aFilteredModels
                );

                // ---------------------------------------------------------
                // 7. Create table rows
                // ---------------------------------------------------------

                const aResults = [];

                for (const oModelData of aFilteredModels) {

                    const sEngineType =
                        oModelData.engineType;

                    console.log(
                        "Processing Model:",
                        oModelData.modelCode,
                        "Engine Type:",
                        sEngineType
                    );

                    // -----------------------------------------------------
                    // Pricing Component
                    // -----------------------------------------------------

                    const oPricingComponent =
                        aPricingComponents.find(
                            function (oComponent) {

                                return (
                                    oComponent.engineType ===
                                    sEngineType &&

                                    (
                                        oComponent.approvalStatus ===
                                        "APPROVED" ||

                                        !oComponent.approvalStatus
                                    )
                                );
                            }
                        ) || null;

                    console.log(
                        "Pricing Component:",
                        oPricingComponent
                    );

                    // -----------------------------------------------------
                    // RTO Master
                    // -----------------------------------------------------

                    let oRTOMaster = null;

                    if (sOrderType !== "GEM") {

                        oRTOMaster =
                            aRTOMasters.find(
                                function (oRTO) {

                                    const bRegion =
                                        oRTO.region_regionCode ===
                                        sRegion ||

                                        oRTO.regionCode ===
                                        sRegion;

                                    const bEngine =
                                        oRTO.engineType ===
                                        sEngineType;

                                    const bCC =
                                        Number(
                                            oModelData.ccWatt
                                        ) >=
                                        Number(oRTO.ccMin) &&

                                        Number(
                                            oModelData.ccWatt
                                        ) <=
                                        Number(oRTO.ccMax);

                                    return (
                                        bRegion &&
                                        bEngine &&
                                        bCC
                                    );
                                }
                            ) || null;
                    }

                    console.log(
                        "RTO Master:",
                        oRTOMaster
                    );

                    // -----------------------------------------------------
                    // RTO Expenses
                    // -----------------------------------------------------

                    let aRTOExpenses = [];

                    if (sOrderType !== "GEM") {

                        aRTOExpenses =
                            aRTOExpenses.length
                                ? aRTOExpenses
                                : [];
                    }

                    // Use actual RTO expense records
                    const aModelRTOExpenses =
                        aRTOExpenses.filter(
                            function (oExpense) {

                                return (
                                    oExpense.regionCode ===
                                    sRegion
                                );
                            }
                        );

                    // -----------------------------------------------------
                    // FIND EXISTING PRICING RESULT
                    // -----------------------------------------------------

                    let oExistingPricingResult = null;

                    oExistingPricingResult =
                        aPricingResults.find(
                            function (oResult) {

                                const bModel =
                                    oResult.model_modelCode ===
                                    oModelData.modelCode;

                                const bOrderType =
                                    oResult.orderType ===
                                    sOrderType;

                                // GeM does not have region
                                if (sOrderType === "GEM") {

                                    console.log(
                                        "GeM PricingResult Match Check:",
                                        {
                                            dbModel:
                                                oResult.model_modelCode,

                                            uiModel:
                                                oModelData.modelCode,

                                            dbOrderType:
                                                oResult.orderType,

                                            uiOrderType:
                                                sOrderType,

                                            bModel:
                                                bModel,

                                            bOrderType:
                                                bOrderType
                                        }
                                    );

                                    return (
                                        bModel &&
                                        bOrderType
                                    );
                                }

                                // MTS / MTO / EV / CSD
                                const bRegion =
                                    oResult.region_regionCode ===
                                    sRegion;

                                console.log(
                                    "PricingResult Match Check:",
                                    {
                                        dbModel:
                                            oResult.model_modelCode,

                                        uiModel:
                                            oModelData.modelCode,

                                        dbRegion:
                                            oResult.region_regionCode,

                                        uiRegion:
                                            sRegion,

                                        dbOrderType:
                                            oResult.orderType,

                                        uiOrderType:
                                            sOrderType,

                                        bModel:
                                            bModel,

                                        bRegion:
                                            bRegion,

                                        bOrderType:
                                            bOrderType
                                    }
                                );

                                return (
                                    bModel &&
                                    bRegion &&
                                    bOrderType
                                );
                            }
                        ) || null;

                    console.log(
                        "Existing Pricing Result:",
                        {
                            modelCode:
                                oModelData.modelCode,

                            regionCode:
                                sRegion,

                            orderType:
                                sOrderType,

                            result:
                                oExistingPricingResult
                        }
                    );

                    // -----------------------------------------------------
                    // CREATE TABLE ROW
                    // -----------------------------------------------------

                    const oRow = {

                        // -------------------------------------------------
                        // Basic
                        // -------------------------------------------------
                        ID: oExistingPricingResult?.ID ?? "",

                        modelCode:
                            oModelData.modelCode,

                        regionCode:
                            sOrderType === "GEM"
                                ? ""
                                : sRegion,

                        orderType:
                            sOrderType,

                        engineType:
                            sEngineType,

                        ccWatt:
                            oModelData.ccWatt,

                        validFrom:
                            oModelData.validFrom,

                        status:
                            oExistingPricingResult?.status ?? "DRAFT",

                        // -------------------------------------------------
                        // Inputs
                        // -------------------------------------------------

                        inputNSP: oExistingPricingResult?.inputNSP ?? "",
                        exShowroomInput: oExistingPricingResult?.exShowroomPrice ?? "",

                        // -------------------------------------------------
                        // Pricing Component
                        // -------------------------------------------------

                        helmet:
                            oPricingComponent?.helmet ?? 0,

                        transportation:
                            oPricingComponent?.transportation ?? 0,

                        helmetMargin:
                            oPricingComponent?.helmetMargin ?? 0,

                        otherExpenses:
                            Number(oModelData.ccWatt) <= 500
                                ? (
                                    oPricingComponent
                                        ?.otherExpensesBelow500
                                    ?? 0
                                )
                                : (
                                    oPricingComponent
                                        ?.otherExpensesAbove500
                                    ?? 0
                                ),

                        insuranceRate:
                            Number(oModelData.ccWatt) <= 350
                                ? (
                                    oPricingComponent
                                        ?.insuranceRateBelow350
                                    ?? 0
                                )
                                : (
                                    oPricingComponent
                                        ?.insuranceRateAbove350
                                    ?? 0
                                ),

                        tpaPa:
                            Number(oModelData.ccWatt) <= 350
                                ? (
                                    oPricingComponent
                                        ?.tpaPaBelow350
                                    ?? 0
                                )
                                : (
                                    oPricingComponent
                                        ?.tpaPaAbove350
                                    ?? 0
                                ),

                        noPlateCharges:
                            oPricingComponent
                                ?.noPlateCharges ?? 0,

                        // -------------------------------------------------
                        // Model Master Values
                        // -------------------------------------------------

                        gstPercent:
                            oModelData.gstPercent ?? 0,

                        dealerMarginPercent:
                            oModelData.dealerMarginPercent ?? 0,

                        csdDiscountPercent:
                            oModelData.csdDiscountPercent ?? 0,

                        csdGstPercent:
                            oModelData.csdGstPercent ?? 0,

                        gemValue:
                            oModelData.gemValue ?? 0,

                        // -------------------------------------------------
                        // RTO Master
                        // -------------------------------------------------

                        rtoSlab:
                            oRTOMaster?.slab ?? null,

                        rtoPercent:
                            oRTOMaster?.rtoPercent ?? 0,

                        rtoFlatPriceValue:
                            oRTOMaster?.flatPriceValue ?? 0,

                        // -------------------------------------------------
                        // Existing PricingResult
                        // -------------------------------------------------

                        actualNSP:
                            oExistingPricingResult
                                ?.actualNSP ?? "",

                        dealerCost:
                            oExistingPricingResult
                                ?.dealerCost ?? "",

                        ndp:
                            oExistingPricingResult
                                ?.ndp ?? "",

                        dealerMargin:
                            oExistingPricingResult
                                ?.dealerMargin ?? "",

                        totalDealerMargin:
                            oExistingPricingResult
                                ?.totalDealerMargin ?? "",

                        basicPrice:
                            oExistingPricingResult
                                ?.basicPrice ?? "",

                        gstAmount:
                            oExistingPricingResult
                                ?.gstAmount ?? "",

                        exShowroomPrice:
                            oExistingPricingResult
                                ?.exShowroomPrice ?? "",

                        rtoAmount:
                            oExistingPricingResult
                                ?.rtoAmount ?? "",

                        rtoWithBill:
                            oExistingPricingResult
                                ?.rtoWithBill ?? "",

                        insuranceAmount:
                            oExistingPricingResult
                                ?.insuranceAmount ?? "",

                        insuranceGst:
                            oExistingPricingResult
                                ?.insuranceGst ?? "",

                        totalInsurance:
                            oExistingPricingResult
                                ?.totalInsurance ?? "",

                        onRoadPrice:
                            oExistingPricingResult
                                ?.onRoadPrice ?? "",

                        // -------------------------------------------------
                        // MTO
                        // -------------------------------------------------

                        referenceMTSModel:
                            oExistingPricingResult
                                ?.referenceMTSModel ?? "",

                        mtsExShowroom:
                            oExistingPricingResult
                                ?.mtsExShowroom ?? "",

                        mtsOnRoad:
                            oExistingPricingResult
                                ?.mtsOnRoad ?? "",

                        miyExShowroomTotal:
                            oExistingPricingResult
                                ?.miyExShowroomTotal ?? "",

                        miyOnRoadTotal:
                            oExistingPricingResult
                                ?.miyOnRoadTotal ?? "",

                        expectedExShowroom:
                            oExistingPricingResult
                                ?.expectedExShowroom ?? "",

                        expectedOnRoad:
                            oExistingPricingResult
                                ?.expectedOnRoad ?? "",

                        incrementDealer:
                            oExistingPricingResult
                                ?.incrementDealer ?? "",

                        // -------------------------------------------------
                        // GeM
                        // -------------------------------------------------

                        lowestMtsExShowroom:
                            oExistingPricingResult
                                ?.lowestMtsExShowroom ?? "",

                        gemDiscountPercent:
                            oExistingPricingResult
                                ?.gemDiscountPercent ?? 12,

                        gemDiscountAmount:
                            oExistingPricingResult
                                ?.gemDiscountAmount ?? "",

                        gemSubTotal:
                            oExistingPricingResult
                                ?.gemSubTotal ?? "",

                        gemBasic:
                            oExistingPricingResult
                                ?.gemBasic ?? "",

                        gemGstAmount:
                            oExistingPricingResult
                                ?.gemGstAmount ?? "",

                        finalGemPrice:
                            oExistingPricingResult
                                ?.finalGemPrice ?? "",

                        // -------------------------------------------------
                        // CSD
                        // -------------------------------------------------

                        csdNsp:
                            oExistingPricingResult
                                ?.csdNsp ?? "",

                        csdBasicExclHelmet:
                            oExistingPricingResult
                                ?.csdBasicExclHelmet ?? "",

                        csdDiscountAmount:
                            oExistingPricingResult
                                ?.csdDiscountAmount ?? "",

                        csdPreTaxNet:
                            oExistingPricingResult
                                ?.csdPreTaxNet ?? "",

                        csdGstAmount:
                            oExistingPricingResult
                                ?.csdGstAmount ?? "",

                        csdExShowroom:
                            oExistingPricingResult
                                ?.csdExShowroom ?? "",

                        incidentalPercent:
                            oExistingPricingResult
                                ?.incidentalPercent ?? 1,

                        incidentalCharges:
                            oExistingPricingResult
                                ?.incidentalCharges ?? "",

                        finalCsdPrice:
                            oExistingPricingResult
                                ?.finalCsdPrice ?? "",

                        csdOnRoad:
                            oExistingPricingResult
                                ?.csdOnRoad ?? "",

                        // -------------------------------------------------
                        // Internal references
                        // -------------------------------------------------

                        _modelData:
                            oModelData,

                        _pricingComponent:
                            oPricingComponent,

                        _rtoMaster:
                            oRTOMaster,

                        _rtoExpenses:
                            aModelRTOExpenses,

                        _pricingResult:
                            oExistingPricingResult
                    };

                    aResults.push(oRow);
                }

                // ---------------------------------------------------------
                // 8. Set table data
                // ---------------------------------------------------------

                oPricingModel.setProperty(
                    "/results",
                    aResults
                );

                oPricingModel.setProperty(
                    "/resultsCount",
                    aResults.length
                );

                console.log(
                    "Final Pricing Results:",
                    aResults
                );

                console.log(
                    "Results Count:",
                    aResults.length
                );

                MessageToast.show(
                    `${aResults.length} model(s) loaded successfully.`
                );

            } catch (oError) {

                console.error(
                    "Get Data Error:",
                    oError
                );

                MessageBox.error(
                    oError.message ||
                    "Failed to load pricing data."
                );
            }
            this.byId("pricingPanel").setExpanded(true);
        },
        onCalculate: async function () {

            const oTable = this.byId("pricingTable");

            // Get selected table row indexes
            const aSelectedIndices =
                oTable.getSelectedIndices();

            if (aSelectedIndices.length === 0) {
                MessageBox.warning(
                    "Please select at least one model."
                );
                return;
            }

            const oViewModel =
                this.getView().getModel("viewModel");

            const oPricingModel =
                this.getView().getModel("pricingModel");

            const sOrderType =
                oViewModel.getProperty("/orderType");

            const aResults =
                oPricingModel.getProperty("/results");

            // Get selected row objects
            const aSelectedRows =
                aSelectedIndices.map(function (iIndex) {
                    return aResults[iIndex];
                });

            console.log("Order Type:", sOrderType);
            console.log("Selected Rows:", aSelectedRows);

            try {

                switch (sOrderType) {

                    case "MTS":

                        await this._calculateMTS(
                            aSelectedRows
                        );

                        break;

                    case "MTO":

                        await this._calculateMTO(
                            aSelectedRows
                        );

                        break;

                    case "EV":

                        await this._calculateEV(
                            aSelectedRows
                        );

                        break;

                    case "GEM":

                        await this._calculateGeM(
                            aSelectedRows
                        );

                        break;

                    case "CSD":

                        await this._calculateCSD(
                            aSelectedRows
                        );

                        break;

                    default:

                        MessageBox.warning(
                            "Please select a valid Order Type."
                        );

                        return;
                }

                // Refresh table after calculation
                oPricingModel.refresh(true);

                MessageToast.show(
                    "Calculation completed successfully."
                );

            } catch (oError) {

                console.error(
                    "Calculation Error:",
                    oError
                );

                MessageBox.error(
                    oError.message ||
                    "Calculation failed."
                );
            }
        },
        _calculateMTS: async function (aSelectedRows) {

            const oModel = this.getView().getModel();

            for (const oRow of aSelectedRows) {

                if (!oRow.inputNSP) {
                    throw new Error(
                        `Please enter NSP for ${oRow.modelCode}.`
                    );
                }

                console.log("MTS Row:", oRow);

                console.log("MTS Payload:", {
                    NSP: Number(oRow.inputNSP),
                    regionCode: oRow.regionCode,
                    engineType: oRow.engineType,
                    modelCode: oRow.modelCode
                });

                const oAction =
                    oModel.bindContext("/calculateMTS(...)");

                oAction.setParameter(
                    "NSP",
                    Number(oRow.inputNSP)
                );

                oAction.setParameter(
                    "regionCode",
                    oRow.regionCode
                );

                oAction.setParameter(
                    "engineType",
                    oRow.engineType
                );

                oAction.setParameter(
                    "modelCode",
                    oRow.modelCode
                );

                await oAction.execute();
            }

            await this._loadCalculatedResults(aSelectedRows);
        },
        _calculateMTO: async function (aSelectedRows) {

            const oModel = this.getView().getModel();

            const aItems = aSelectedRows.map(function (oRow) {

                return {
                    modelCode: oRow.modelCode,
                    regionCode: oRow.regionCode,
                    engineType: oRow.engineType,
                    orderType: oRow.orderType,
                    validFrom: oRow.validFrom,
                    parts: oRow.parts || []
                };

            });

            console.log("MTO Payload:", aItems);

            const oAction =
                oModel.bindContext("/calculateMTO(...)");

            oAction.setParameter("items", aItems);

            await oAction.execute();

            await this._loadCalculatedResults(aSelectedRows);
        },
        _calculateEV: async function (aSelectedRows) {

            const oModel = this.getView().getModel();

            for (const oRow of aSelectedRows) {

                if (!oRow.inputNSP) {
                    throw new Error(
                        `Please enter NSP for ${oRow.modelCode}.`
                    );
                }

                const oAction =
                    oModel.bindContext("/calculateEV(...)");

                oAction.setParameter("item", {
                    modelCode: oRow.modelCode,
                    regionCode: oRow.regionCode,
                    nsp: Number(oRow.inputNSP)
                });

                await oAction.execute();
            }

            await this._loadCalculatedResults(aSelectedRows);
        },
        _calculateGeM: async function (aSelectedRows) {

            const oModel = this.getView().getModel();

            const aModelCodes =
                aSelectedRows.map(function (oRow) {
                    return oRow.modelCode;
                });

            const oAction =
                oModel.bindContext("/calculateGeM(...)");

            oAction.setParameter(
                "modelCodes",
                aModelCodes
            );

            await oAction.execute();

            // Reload calculated GeM values from DB
            await this._loadCalculatedResults(aSelectedRows);
        },
        _calculateCSD: async function (aSelectedRows) {

            const oModel = this.getView().getModel();

            try {

                // One region for all selected models
                const sRegionCode = aSelectedRows[0].regionCode;

                // Collect all selected model codes
                const aModelCodes = aSelectedRows.map(function (oRow) {
                    return oRow.modelCode;
                });

                console.log("Calculating CSD:", {
                    modelCodes: aModelCodes,
                    regionCode: sRegionCode
                });

                const oAction =
                    oModel.bindContext("/calculateCSD(...)");

                oAction.setParameter("modelCode", aModelCodes);
                oAction.setParameter("regionCode", sRegionCode);

                await oAction.execute();

                console.log("CSD calculation completed");

                // Reload calculated CSD values from DB
                await this._loadCalculatedResults(aSelectedRows);

            } catch (oError) {

                console.error("CSD Calculation Error:", oError);

                sap.m.MessageBox.error(
                    "CSD calculation failed. Please check the backend logs."
                );
            }
        },
        _loadCalculatedResults: async function (aSelectedRows) {

            const oModel = this.getView().getModel();
            const oPricingModel =
                this.getView().getModel("pricingModel");

            try {

                // Read all saved calculation results from DB
                const aPricingResults =
                    await this._readEntity(
                        oModel,
                        "/PricingResults"
                    );

                console.log(
                    "PricingResults from DB:",
                    aPricingResults
                );

                // Update each selected table row
                aSelectedRows.forEach(function (oRow) {

                    const oDBResult =
                        aPricingResults.find(function (oResult) {

                            const bModel =
                                oResult.model_modelCode ===
                                oRow.modelCode;

                            const bOrderType =
                                oResult.orderType ===
                                oRow.orderType;

                            // GeM has no region
                            if (oRow.orderType === "GEM") {

                                return (
                                    bModel &&
                                    bOrderType
                                );
                            }

                            // MTS / MTO / EV / CSD
                            const bRegion =
                                oResult.region_regionCode ===
                                oRow.regionCode;

                            return (
                                bModel &&
                                bRegion &&
                                bOrderType
                            );
                        });

                    console.log(
                        "Calculated DB Result:",
                        {
                            modelCode: oRow.modelCode,
                            regionCode: oRow.regionCode,
                            orderType: oRow.orderType,
                            result: oDBResult
                        }
                    );

                    if (!oDBResult) {
                        console.warn(
                            "No PricingResult found for:",
                            oRow.modelCode,
                            oRow.regionCode,
                            oRow.orderType
                        );

                        return;
                    }

                    /*
                     * =====================================================
                     * COMMON / MTS / EV VALUES
                     * =====================================================
                     */
                    Object.assign(oRow, {
                        ID: oDBResult.ID ?? "",
                        inputNSP:
                            oDBResult.inputNSP ?? "",
                        status:
                            oDBResult.status ?? "DRAFT",

                        exShowroomInput:
                            oDBResult.exShowroomInput ?? "",

                        actualNSP:
                            oDBResult.actualNSP ?? "",

                        dealerCost:
                            oDBResult.dealerCost ?? "",

                        ndp:
                            oDBResult.ndp ?? "",

                        dealerMargin:
                            oDBResult.dealerMargin ?? "",

                        totalDealerMargin:
                            oDBResult.totalDealerMargin ?? "",

                        basicPrice:
                            oDBResult.basicPrice ?? "",

                        gstAmount:
                            oDBResult.gstAmount ?? "",

                        exShowroomPrice:
                            oDBResult.exShowroomPrice ?? "",

                        rtoAmount:
                            oDBResult.rtoAmount ?? "",

                        rtoWithBill:
                            oDBResult.rtoWithBill ?? "",

                        insuranceAmount:
                            oDBResult.insuranceAmount ?? "",

                        insuranceGst:
                            oDBResult.insuranceGst ?? "",

                        totalInsurance:
                            oDBResult.totalInsurance ?? "",

                        tpaPa:
                            oDBResult.tpaPa ?? "",

                        onRoadPrice:
                            oDBResult.onRoadPrice ?? "",


                        /*
                         * =================================================
                         * MTO VALUES
                         * =================================================
                         */

                        referenceMTSModel:
                            oDBResult.referenceMTSModel_modelCode ?? "",

                        mtsExShowroom:
                            oDBResult.mtsExShowroom ?? "",

                        mtsOnRoad:
                            oDBResult.mtsOnRoad ?? "",

                        miyExShowroomTotal:
                            oDBResult.miyExShowroomTotal ?? "",

                        miyOnRoadTotal:
                            oDBResult.miyOnRoadTotal ?? "",

                        expectedExShowroom:
                            oDBResult.expectedExShowroom ?? "",

                        expectedOnRoad:
                            oDBResult.expectedOnRoad ?? "",

                        incrementDealer:
                            oDBResult.incrementDealer ?? "",


                        /*
                         * =================================================
                         * GeM VALUES
                         * =================================================
                         */

                        lowestMtsExShowroom:
                            oDBResult.lowestMtsExShowroom ?? "",

                        gemDiscountPercent:
                            oDBResult.gemDiscountPercent ?? "",

                        gemDiscountAmount:
                            oDBResult.gemDiscountAmount ?? "",

                        gemSubTotal:
                            oDBResult.gemSubTotal ?? "",

                        gemBasic:
                            oDBResult.gemBasic ?? "",

                        gemGstAmount:
                            oDBResult.gemGstAmount ?? "",

                        finalGemPrice:
                            oDBResult.finalGemPrice ?? "",


                        /*
                         * =================================================
                         * CSD VALUES
                         * =================================================
                         */

                        csdNsp:
                            oDBResult.csdNsp ?? "",

                        csdBasicExclHelmet:
                            oDBResult.csdBasicExclHelmet ?? "",

                        csdDiscountPercent:
                            oDBResult.csdDiscountPercent ?? "",

                        csdDiscountAmount:
                            oDBResult.csdDiscountAmount ?? "",

                        csdPreTaxNet:
                            oDBResult.csdPreTaxNet ?? "",

                        csdGstPercent:
                            oDBResult.csdGstPercent ?? "",

                        csdGstAmount:
                            oDBResult.csdGstAmount ?? "",

                        csdExShowroom:
                            oDBResult.csdExShowroom ?? "",

                        incidentalPercent:
                            oDBResult.incidentalPercent ?? "",

                        incidentalCharges:
                            oDBResult.incidentalCharges ?? "",

                        finalCsdPrice:
                            oDBResult.finalCsdPrice ?? "",

                        csdOnRoad:
                            oDBResult.csdOnRoad ?? ""
                    });
                });

                /*
                 * Tell JSONModel that the table data has changed.
                 */
                oPricingModel.refresh(true);

                console.log(
                    "Table updated with calculated DB results."
                );

            } catch (oError) {

                console.error(
                    "Error loading calculated results:",
                    oError
                );

                throw oError;
            }
        },
        onSubmit: async function () {

            const oTable = this.byId("pricingTable");
            const oPricingModel = this.getView().getModel("pricingModel");

            // Get selected table rows
            const aSelectedIndices = oTable.getSelectedIndices();

            if (aSelectedIndices.length === 0) {
                MessageBox.warning("Please select at least one pricing line to submit.");
                return;
            }

            // Get selected rows from JSONModel
            const aResults = oPricingModel.getProperty("/results");

            const aSelectedRows = aSelectedIndices.map(function (iIndex) {
                return aResults[iIndex];
            });

            // Get PricingResults UUIDs
            const aResultIDs = aSelectedRows
                .map(function (oRow) {
                    return oRow.ID;
                })
                .filter(Boolean);

            // Validate IDs
            if (aResultIDs.length !== aSelectedRows.length) {
                MessageBox.error(
                    "One or more selected rows do not have a Pricing Result ID."
                );
                return;
            }

            // Ask for comments
            const oDialog = new sap.m.Dialog({
                title: "Submit Pricing",
                contentWidth: "450px",
                content: [
                    new sap.m.Label({
                        text: "Comments",
                        labelFor: "submitComments"
                    }),
                    new sap.m.TextArea("submitComments", {
                        width: "100%",
                        rows: 5,
                        maxLength: 1000,
                        placeholder: "Enter comments..."
                    })
                ],
                beginButton: new sap.m.Button({
                    text: "Submit",
                    type: "Emphasized",
                    press: async function () {

                        const sComments =
                            sap.ui.getCore()
                                .byId("submitComments")
                                .getValue();

                        oDialog.close();

                        try {

                            const oModel = this.getView().getModel();

                            // Unbound OData V4 action
                            const oAction =
                                oModel.bindContext("/submitPricing(...)");

                            // Action parameter: many UUID
                            oAction.setParameter(
                                "resultIDs",
                                aResultIDs
                            );

                            // Action parameter: String
                            oAction.setParameter(
                                "comments",
                                sComments
                            );

                            // Execute action
                            await oAction.execute();

                            // Get action response
                            const oResponse =
                                oAction.getBoundContext()
                                    ?.getObject();

                            MessageBox.success(
                                `Pricing submitted successfully.\n\n` +
                                `Reference Number: ${oResponse?.referenceNumber || ""}\n` +
                                `Lines: ${oResponse?.lines || aResultIDs.length}`,
                                {
                                    title: "Submission Successful"
                                }
                            );

                            // Clear table selection
                            oTable.clearSelection();

                            // Refresh PricingResults
                            await this._loadCalculatedResults(aSelectedRows);

                        } catch (oError) {

                            console.error(
                                "Submit Pricing Error:",
                                oError
                            );

                            MessageBox.error(
                                oError.message ||
                                "Failed to submit pricing."
                            );
                        }
                    }.bind(this)
                }),
                endButton: new sap.m.Button({
                    text: "Cancel",
                    press: function () {
                        oDialog.close();
                    }
                }),
                afterClose: function () {
                    oDialog.destroy();
                }
            });

            this.getView().addDependent(oDialog);
            oDialog.open();
        },
        onDelete: function () {

            const oTable = this.byId("pricingTable");
            const aSelectedIndices = oTable.getSelectedIndices();

            if (!aSelectedIndices.length) {
                sap.m.MessageToast.show("Please select at least one row to delete.");
                return;
            }

            sap.m.MessageBox.confirm(
                "Are you sure you want to delete the selected pricing result(s)?",
                {
                    title: "Confirm Delete",

                    actions: [
                        sap.m.MessageBox.Action.YES,
                        sap.m.MessageBox.Action.NO
                    ],

                    emphasizedAction: sap.m.MessageBox.Action.YES,

                    onClose: async function (sAction) {

                        if (sAction !== sap.m.MessageBox.Action.YES) {
                            return;
                        }

                        await this._deleteSelectedRows(aSelectedIndices);
                    }.bind(this)
                }
            );
        },
        _deleteSelectedRows: async function (aSelectedIndices) {

            const oTable = this.byId("pricingTable");

            const oPricingModel =
                this.getView().getModel("pricingModel");

            const oODataModel =
                this.getView().getModel();

            const aResults =
                oPricingModel.getProperty("/results");

            try {

                const aSelectedRows = aSelectedIndices
                    .map(iIndex => aResults[iIndex])
                    .filter(oRow => oRow && oRow.ID);

                if (!aSelectedRows.length) {
                    sap.m.MessageToast.show(
                        "No valid rows selected."
                    );
                    return;
                }

                console.log(
                    "Rows to delete:",
                    aSelectedRows
                );

                // Delete from OData
                for (const oRow of aSelectedRows) {

                    console.log(
                        "Deleting PricingResult:",
                        oRow.ID
                    );

                    const oContext =
                        oODataModel.bindContext(
                            `/PricingResults(${oRow.ID})`
                        );

                    await oContext.requestObject();

                    const oEntityContext =
                        oContext.getBoundContext();

                    await oEntityContext.delete("$auto");
                }

                // Remove deleted rows from JSONModel
                const aDeletedIDs =
                    aSelectedRows.map(oRow => oRow.ID);

                const aRemainingResults =
                    aResults.filter(
                        oRow => !aDeletedIDs.includes(oRow.ID)
                    );

                oPricingModel.setProperty(
                    "/results",
                    aRemainingResults
                );

                oPricingModel.refresh(true);

                oTable.clearSelection();

                sap.m.MessageToast.show(
                    `${aSelectedRows.length} pricing result(s) deleted successfully.`
                );

            } catch (oError) {

                console.error(
                    "Delete Error:",
                    oError
                );

                sap.m.MessageBox.error(
                    "Failed to delete the selected pricing result(s)."
                );
            }
        },
        onApplyToOtherRegions: async function () {
            const oTable = this.byId("pricingTable");
            const oPricingModel = this.getView().getModel("pricingModel");

            const aSelectedIndices = oTable.getSelectedIndices();

            if (aSelectedIndices.length !== 1) {
                MessageBox.warning(
                    "Please select one calculated pricing row."
                );
                return;
            }

            const aResults = oPricingModel.getProperty("/results") || [];
            const oSelectedRow = aResults[aSelectedIndices[0]];

            if (!oSelectedRow || !oSelectedRow.ID) {
                MessageBox.warning(
                    "Please calculate the selected pricing row first."
                );
                return;
            }

            this._oSelectedApplyRow = oSelectedRow;

            try {
                // Load available regions
                const aRegions = await this._readEntity(
                    this.getView().getModel(),
                    "/Regions"
                );

                // Exclude Tamil Nadu from the target regions
                const aOtherRegions = aRegions.filter(function (oRegion) {
                    return oRegion.regionCode !== "TN01";
                });

                // Create model for the fragment
                const oRegionSelectionModel = new JSONModel({
                    regions: aOtherRegions,
                });

                // Load fragment only once
                if (!this._pApplyRegionsDialog) {
                    this._pApplyRegionsDialog = this.loadFragment({
                        name: "vpapricing.view.ApplyToOtherRegions"
                    });
                }

                const oDialog = await this._pApplyRegionsDialog;

                // Set the region selection model
                oDialog.setModel(
                    oRegionSelectionModel,
                    "regionSelectionModel"
                );

                // Clear previous selections
                this.byId("regionCombo").setSelectedKeys([]);

                // Open dialog
                oDialog.open();

            } catch (oError) {
                console.error("Failed to open Apply to Other Regions dialog:", oError);
                MessageBox.error("Failed to load regions.");
            }
        },

        onConfirmApplyToOtherRegions: async function () {
            const oCombo = this.byId("regionCombo");
            const aRegionCodes = oCombo.getSelectedKeys();

            if (!aRegionCodes.length) {
                MessageBox.warning("Please select at least one region.");
                return;
            }

            const oSelectedRow = this._oSelectedApplyRow;
            const oModel = this.getView().getModel();
            const oDialog = await this._pApplyRegionsDialog;

            const oSelectionLabel = this.byId("regionSelectionLabel");
            const oBusySection = this.byId("calculationBusySection");
            const oApplyButton = oDialog.getBeginButton();
            const oCancelButton = oDialog.getEndButton();

            const oPayload = {
                modelCodes: [oSelectedRow.modelCode],
                regionCodes: aRegionCodes,
                orderType: oSelectedRow.orderType
            };

            console.log("calculateMultiRegion - Request Payload:", oPayload);

            try {
                // Show loading indicator
                oBusySection.setVisible(true);

                // Disable dropdown and both buttons
                oSelectionLabel.setVisible(false);
                oCombo.setEnabled(false);
                oApplyButton.setEnabled(false);
                oCancelButton.setEnabled(false);

                const oAction = oModel.bindContext(
                    "/calculateMultiRegion(...)"
                );

                oAction.setParameter("input", oPayload);

                await new Promise(function (resolve) {
                    setTimeout(resolve, 0);
                });

                await oAction.execute();

                MessageToast.show(
                    "Pricing calculation completed for the selected regions."
                );

                oDialog.close();

            } catch (oError) {
                console.error("Apply to Other Regions failed:", oError);

                MessageBox.error(
                    oError.message ||
                    "Failed to calculate pricing for the selected regions."
                );

            } finally {
                // Restore controls if the dialog is still open
                // oBusySection.setVisible(false);
                // oCombo.setEnabled(true);
                // oSelectionLabel.setVisible(true);
                // oApplyButton.setEnabled(true);
                // oCancelButton.setEnabled(true);
            }
        },

        onCancelApplyToOtherRegions: async function () {
            const oDialog = await this._pApplyRegionsDialog;
            oDialog.close();
        },

    });
});