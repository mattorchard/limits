(function optionsMain() {
    let policies = [];
    const policyList = document.querySelector("#policyList");
    const policyTemplate = document.querySelector("#policyTemplate");

    // Load Policies from cloud
    chrome.storage.sync.get(['policies'], response => {
        const policiesCloud = response['policies'];
        if (policiesCloud) {
            policies = policiesCloud;
            policies.forEach(addPolicyElem);
        }
        onPoliciesLoaded();
    });

    const getPolicyFields = policyElem => {
        const limitReadout = policyElem.querySelector('input[name="limit"]');
        const url = policyElem.querySelector('input[name="url"]');
        return {
            limit: limitReadout.value,
            url: url.value,
            id: policyElem.id
        }
    };

    const onPoliciesLoaded = () => 
        document.querySelectorAll(".pre-policy-load")
        .forEach(elem => elem.classList.remove("pre-policy-load"));
    
    const saveAllPolicies = async () => new Promise(resolve => {
        console.log("Saving policies", policies)
        chrome.storage.sync.set({
            'policies': policies
        }, resolve);
    });
    
    const savePolicy = async editedPolicy => {
        const {id, url} = editedPolicy;
        if (!url) {
            throw new Error("Policy must have a url");
        } else if (url !== id && policies.some(policy => policy.url === url)) {
            throw new Error("Policy must have a UNIQUE url");
        } else {
            if (id) {
                // Remove old policy
                policies = policies.filter(policy => policy.url !== id);
            }
            policies.push(editedPolicy);
        }
        await saveAllPolicies();
        return editedPolicy.url;
    };

    const deletePolicy = async policyId => {
        policies = policies.filter(policy => policy.url !== policyId);
        return saveAllPolicies();
    }

    const setEditable = (policyElem, editable) => {
        const form = policyElem.querySelector(".policy-form");
        const fields = policyElem.querySelector(".policy-form__fields");
        fields.disabled = !editable;
        if (editable) {
            form.classList.remove("disabled");
        } else {
            form.classList.add("disabled");
        }
    }


    const addPolicyElem = policy => {
        const clone = document.importNode(policyTemplate.content, true);

        // Save Option
        const policyForm = clone.querySelector('.policy-form');
        policyForm.addEventListener("submit", async event => {
            event.preventDefault();
            const policyElem = event.currentTarget.closest(".policy");
            try {
                const policy = getPolicyFields(policyElem);
                const id = await savePolicy(policy);
                policyElem.id = id;
                setEditable(policyElem, false);
            } catch (error) {
                console.warn("Failed to save policy", error)
            }
        });

        // Enable edit
        const editButton = clone.querySelector('button[name="edit"]');
        editButton.addEventListener("click", event => {
            const policyElem = event.currentTarget.closest(".policy");
            setEditable(policyElem, true);
            const urlField = policyElem.querySelector('input[name="url"]');
            urlField.focus();
        });

        // Delete
        const deleteButton = clone.querySelector('button[name="delete"]');
        deleteButton.addEventListener("click", async event => {
            const policyElem = event.currentTarget.closest(".policy");
            if (policyElem.id) {
                try {
                    await deletePolicy(policyElem.id);
                    policyElem.remove();
                } catch(error) {
                    console.error("Failed to delete policy", error);
                }
            } else {
                console.warn("Delete on an unsaved policy");
                policyElem.remove();
            }
        });

        const urlField = clone.querySelector('input[name="url"]');
        urlField.addEventListener("change", event => {
            const target = event.currentTarget;
            const value = target.value;
            target.setAttribute("value", value);
            const matchingUrls = document.querySelectorAll(`input[name="url"][value="${value}"]`);
            target.setCustomValidity(matchingUrls.length > 1 ? "URL must be unqique" : "")
        });

        const policyElem = clone.querySelector(".policy");
        if (policy) {
            const {url, limit} = policy;
            policyElem.id = url;
            
            urlField.value = url;
            urlField.setAttribute("value", url);
            const limitReadout = clone.querySelector('input[name="limit"]');
            limitReadout.value = limit;
            
        } else {
            setEditable(policyElem, true);
        }
        
        policyList.appendChild(clone);
        if (!policy) {
            urlField.focus();
        }

    }

    const addButton = document.querySelector(".add-button");
    addButton.addEventListener("click", () => addPolicyElem());
})();