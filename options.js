(function optionsMain() {
    const policyList = document.querySelector("#policyList");
    const policyTemplate = document.querySelector("#policyTemplate");

    const getPolicyFields = policyElem => {
        const limitReadout = policyElem.querySelector('input[name="limit"]');
        const url = policyElem.querySelector('input[name="url"]');
        return {
            limit: limitReadout.value,
            url: url.value,
            id: policyElem.id
        }
    } ;
    
    const savePolicy = async policy => {
        // Todo: This
        return policy.id;
    };

    const deletePolicy = async policyId => {
        // Todo: This
        return true;
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
        // Limit Slider
        const limitReadout = clone.querySelector('input[name="limit"]');
        // const limitSlider = clone.querySelector('input[name="limit-slider"]');
        // limitSlider.addEventListener("input", event => limitReadout.value = event.currentTarget.value);
        // Save Option
        const policyForm = clone.querySelector('.policy-form');
        policyForm.addEventListener("submit", async event => {
            event.preventDefault();
            try {
                const policyElem = event.currentTarget.closest(".policy");
                const policy = getPolicyFields(policyElem);
                const id = await savePolicy(policy);
                policyElem.id = id;
                setEditable(policyElem, false);
            } catch (error) {
                console.error("Error trying to save policy", error);
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
                console.warn("Unsupported operation, this feature has not yet been added");
                try {
                    await deletePolicy(policyElem.id);
                    policyElem.remove();
                } catch(error) {
                    console.error("Failed to delete policy", error);
                }
            } else {
                console.warn("Cannot delete an item until it has an ID");
            }
        });

        const policyElem = clone.querySelector(".policy");
        if (policy) {
            const {url, limit} = policy;
            policyElem.id = url;
            
            const urlField = clone.querySelector('input[name="url"]');
            urlField.value = url;
            limitReadout.value = limit;
        } else {
            setEditable(policyElem, true);
        }
        
        policyList.appendChild(clone);
    }
    
    addPolicyElem({url: "netflix.com", limit: 1.5});
    addPolicyElem({url: "youtube.com", limit: 1});
    addPolicyElem();
    
    const addButton = document.querySelector(".add-button");
    addButton.addEventListener("click", () => addPolicyElem());

})();