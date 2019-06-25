import * as React from 'React';
import isEqual from 'lodash/isEqual';
import classNames from 'classnames';
import { Field, FormInstance } from 'rc-field-form';
import { FieldProps as RcFieldProps } from 'rc-field-form/lib/Field';
import { Meta } from 'rc-field-form/lib/interface';
import Row from '../grid/row';
import { ConfigContext, ConfigConsumerProps } from '../config-provider';
import { tuple } from '../_util/type';
import warning from '../_util/warning';
import FormItemLabel, { FormItemLabelProps } from './FormItemLabel';
import FormItemInput, { FormItemInputProps } from './FormItemInput';
import { FormContext, FormItemContext } from './context';
import { toArray } from './util';

const ValidateStatuses = tuple('success', 'warning', 'error', 'validating', '');
export type ValidateStatus = (typeof ValidateStatuses)[number];

type RenderChildren = (
  control: {
    value?: any;
    onChange?: (...args: any[]) => void;
    [name: string]: any;
  },
  meta: Meta,
  context: FormInstance,
) => React.ReactElement;

interface FormItemProps extends FormItemLabelProps, FormItemInputProps, RcFieldProps {
  prefixCls?: string;
  inline?: boolean;
  style?: React.CSSProperties;
  className?: string;
  children: React.ReactElement | RenderChildren;
  id?: string;
  hasFeedback?: boolean;
  validateStatus?: ValidateStatus;
}

const FormItem: React.FC<FormItemProps> = (props: FormItemProps) => {
  const {
    name,
    inline,
    dependencies,
    prefixCls: customizePrefixCls,
    style,
    className,
    shouldUpdate,
    hasFeedback,
    rules,
    validateStatus,
    children,
    trigger = 'onChange',
    validateTrigger = 'onChange',
  } = props;
  const { getPrefixCls } = React.useContext(ConfigContext);
  const { name: formName } = React.useContext(FormContext);
  const { updateItemErrors } = React.useContext(FormItemContext);
  const [domErrorVisible, setDomErrorVisible] = React.useState(false);
  const [inlineErrors, setInlineErrors] = React.useState<Record<string, string[]>>({});

  // Should clean up if Field removed
  React.useEffect(() => {
    return () => {
      updateItemErrors(toArray(name).join('__SPLIT__'), []);
    };
  }, []);

  const prefixCls = getPrefixCls('form', customizePrefixCls);

  return (
    <Field {...props} trigger={trigger} validateTrigger={validateTrigger}>
      {(control, meta, context) => {
        const { errors } = meta;

        // ======================== Errors ========================
        // Collect inline Field error to the top FormItem
        const updateChildItemErrors = inline
          ? updateItemErrors
          : (subName: string, subErrors: string[]) => {
              if (!isEqual(inlineErrors[subName], subErrors)) {
                setInlineErrors({
                  ...inlineErrors,
                  [subName]: subErrors,
                });
              }
            };

        if (inline) {
          updateItemErrors(toArray(name).join('__SPLIT__'), errors);
        }

        let mergedErrors: string[] = errors;
        Object.keys(inlineErrors).forEach(subName => {
          const subErrors = inlineErrors[subName] || [];
          if (subErrors.length) {
            mergedErrors = [...mergedErrors, ...subErrors];
          }
        });

        // ======================== Status ========================
        let mergedValidateStatus: ValidateStatus = '';
        if (validateStatus !== undefined) {
          mergedValidateStatus = validateStatus;
        } else if (meta.validating) {
          mergedValidateStatus = 'validating';
        } else if (mergedErrors.length) {
          mergedValidateStatus = 'error';
        } else if (meta.touched) {
          mergedValidateStatus = 'success';
        }

        // ====================== Class Name ======================
        const itemClassName = {
          [`${prefixCls}-item`]: true,
          [`${prefixCls}-item-with-help`]: domErrorVisible, // TODO: handle this
          [`${className}`]: !!className,

          // Status
          [`${prefixCls}-item-has-feedback`]:
            (mergedValidateStatus && hasFeedback) || mergedValidateStatus === 'validating',
          [`${prefixCls}-item-has-success`]: mergedValidateStatus === 'success',
          [`${prefixCls}-item-has-warning`]: mergedValidateStatus === 'warning',
          [`${prefixCls}-item-has-error`]: mergedValidateStatus === 'error',
          [`${prefixCls}-item-has-error-leave`]:
            domErrorVisible && mergedValidateStatus !== 'error',
          [`${prefixCls}-item-is-validating`]: mergedValidateStatus === 'validating',
        };

        // TODO: Check if user add `required` in RuleRender
        const isRequired: boolean = !!(
          rules && rules.some(rule => typeof rule === 'object' && rule.required)
        );

        // ======================= Children =======================
        const mergedControl: typeof control = {
          ...control,
          id: `${formName}_${toArray(name).join('_')}`,
        };

        let childNode;
        if (!name && !shouldUpdate && !dependencies) {
          childNode = children;
        } else if (React.isValidElement(children)) {
          const childProps = { ...children.props, ...mergedControl };

          // We should keep user origin event handler
          const triggers = new Set<string>();
          [...toArray(trigger), ...toArray(validateTrigger)].forEach(eventName => {
            triggers.add(eventName);
          });

          triggers.forEach(eventName => {
            if (eventName in mergedControl && eventName in children.props) {
              childProps[eventName] = (...args: any[]) => {
                mergedControl[eventName](...args);
                children.props[eventName](...args);
              };
            }
          });

          childNode = React.cloneElement(children, childProps);
        } else if (typeof children === 'function') {
          warning(
            false,
            'Form.Item',
            'render props is a dev test api. Not works on production env.',
          );
          if (process.env.NODE_ENV === 'production') {
            throw new Error('render props of Form.Item do not work on production env.');
          }
          childNode = children(mergedControl, meta, context);
        }

        if (inline) {
          return childNode;
        }

        return (
          <Row type="flex" className={classNames(itemClassName)} style={style} key="row">
            {/* Label */}
            <FormItemLabel {...props} required={isRequired} prefixCls={prefixCls} />
            {/* Input Group */}
            <FormItemInput
              {...props}
              {...meta}
              errors={mergedErrors}
              prefixCls={prefixCls}
              onDomErrorVisibleChange={setDomErrorVisible}
              validateStatus={mergedValidateStatus}
            >
              <FormItemContext.Provider value={{ updateItemErrors: updateChildItemErrors }}>
                {childNode}
              </FormItemContext.Provider>
            </FormItemInput>
          </Row>
        );
      }}
    </Field>
  );
};

export default FormItem;
