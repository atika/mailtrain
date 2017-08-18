'use strict';

import React, {Component} from "react";
import PropTypes from "prop-types";
import {translate} from "react-i18next";
import {requiresAuthenticatedUser, withPageHelpers} from "../../lib/page";
import {Button, ButtonRow, Dropdown, Form, TableSelect, withForm} from "../../lib/form";
import {withErrorHandling} from "../../lib/error-handling";
import {getRuleHelpers} from "./rule-helpers";
import {getFieldTypes} from "../fields/field-types";

import styles from "./CUD.scss";

@translate()
@withForm
@withPageHelpers
@withErrorHandling
@requiresAuthenticatedUser
export default class CUD extends Component {
    constructor(props) {
        super(props);

        const t = props.t;
        this.ruleHelpers = getRuleHelpers(t, props.fields);
        this.fieldTypes = getFieldTypes(t);

        this.state = {};

        this.initForm({
            onChange: ::this.onFormChange
        });
    }

    static propTypes = {
        rule: PropTypes.object.isRequired,
        fields: PropTypes.array.isRequired,
        onChange: PropTypes.func.isRequired,
        onClose: PropTypes.func.isRequired,
        forceShowValidation: PropTypes.bool.isRequired
    }

    updateStateFromProps(props, populateForm) {
        if (populateForm) {
            const rule = props.rule;
            const ruleHelpers = this.ruleHelpers;

            let data;
            if (!ruleHelpers.isCompositeRuleType(rule.type)) {
                const settings = ruleHelpers.getRuleTypeSettings(rule);
                if (settings) {
                    data = settings.getFormData(rule);
                } else {
                    data = {}; // This handles the case of a new rule, which does not have a type and column yet
                }

                data.type = rule.type || ''; // On '', we display label "--SELECT--" in the type dropdown. Null would not be accepted by React.
                data.column = rule.column;

            } else {
                data = {
                    type: rule.type
                };
            }

            this.populateFormValues(data);
        }

        if (props.forceShowValidation) {
            this.showFormValidation();
        }
        
    }
    
    componentDidMount() {
        this.updateStateFromProps(this.props, true);
    }

    componentWillReceiveProps(nextProps) {
        this.updateStateFromProps(nextProps, this.props.rule !== nextProps.rule);
    }

    localValidateFormValues(state) {
        const t = this.props.t;
        const ruleHelpers = this.ruleHelpers;

        for (const key of state.keys()) {
            state.setIn([key, 'error'], null);
        }

        const ruleType = state.getIn(['type', 'value']);
        if (!ruleHelpers.isCompositeRuleType(ruleType)) {
            const columnType = state.getIn(['column', 'value']);

            if (columnType) {
                const colType = ruleHelpers.getColumnType(columnType);

                if (ruleType) {
                    const settings = ruleHelpers.primitiveRuleTypes[colType][ruleType];
                    settings.validate(state);
                } else {
                    state.setIn(['type', 'error'], t('Type must be selected'));
                }
            } else {
                state.setIn(['column', 'error'], t('Field must be selected'));
            }
        }
    }

    onFormChange(newState) {
        const noErrors = !newState.formState.get('data').find(attr => attr.get('error'));

        if (noErrors) {
            const rule = this.props.rule;
            const ruleHelpers = this.ruleHelpers;

            rule.type = newState.formState.getIn(['data','type','value']);

            if (!ruleHelpers.isCompositeRuleType(rule.type)) {
                rule.column = newState.formState.getIn(['data','column','value']);

                const settings = this.ruleHelpers.getRuleTypeSettings(rule);
                settings.assignRuleSettings(rule, key => newState.formState.getIn(['data', key, 'value']));
            }

            this.props.onChange(false);
        } else {
            this.props.onChange(true);
        }
    }

    async closeForm() {
        if (this.isFormWithoutErrors()) {
            this.props.onClose();
        } else {
            this.showFormValidation();
        }
    }


    render() {
        const t = this.props.t;
        const rule = this.props.rule;
        const ruleHelpers = this.ruleHelpers;

        let ruleOptions = null;
        if (ruleHelpers.isCompositeRuleType(rule.type)) {
            ruleOptions = <Dropdown id="type" label={t('Type')} options={ruleHelpers.getCompositeRuleTypeOptions()} />

        } else {
            const ruleColumnOptionsColumns = [
                { data: 1, title: t('Name') },
                { data: 2, title: t('Type') },
                { data: 3, title: t('Merge Tag') }
            ];

            const ruleColumnOptions = ruleHelpers.fields.map(fld => [ fld.column, fld.name, this.fieldTypes[fld.type].label, fld.tag || '' ]);

            const ruleColumnSelect = <TableSelect id="column" label={t('Field')} data={ruleColumnOptions} columns={ruleColumnOptionsColumns} dropdown withHeader selectionLabelIndex={1} />;
            let ruleTypeSelect = null;
            let ruleSettings = null;

            const ruleColumn = this.getFormValue('column');
            if (ruleColumn) {
                const colType = ruleHelpers.getColumnType(ruleColumn);
                if (colType) {
                    const ruleTypeOptions = ruleHelpers.getPrimitiveRuleTypeOptions(colType);
                    ruleTypeOptions.unshift({ key: '', label: t('-- Select --')});

                    if (ruleTypeOptions) {
                        ruleTypeSelect = <Dropdown id="type" label={t('Type')} options={ruleTypeOptions} />

                        const ruleType = this.getFormValue('type');
                        if (ruleType) {
                            ruleSettings = ruleHelpers.primitiveRuleTypes[colType][ruleType].form;
                        }
                    }
                }
            }

            ruleOptions =
                <div>
                    {ruleColumnSelect}
                    {ruleTypeSelect}
                    {ruleSettings}
                </div>;
        }


        return (
            <div className={styles.ruleOptions}>
                <h3>{t('Rule Options')}</h3>

                <Form stateOwner={this} onSubmitAsync={::this.closeForm}>

                    {ruleOptions}

                    <ButtonRow>
                        <Button type="submit" className="btn-primary" icon="chevron-left" label={t('OK')}/>
                    </ButtonRow>
                </Form>
            </div>
        );
    }
}