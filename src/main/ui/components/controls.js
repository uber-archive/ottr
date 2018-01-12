// @flow

import React from 'react';
import FontAwesome from 'react-fontawesome';
import styled from 'styled-components';

const FontAwesomeWrapper = styled.a`
  margin: 5px;
  cursor: pointer;
  display: inline-block;
  vertical-align: middle;
  color: inherit;
`;

export const FontAwesomeButton = (props: any) => (
    <FontAwesomeWrapper href={props.href} target={props.target}>
      <FontAwesome {...props} />
    </FontAwesomeWrapper>
);